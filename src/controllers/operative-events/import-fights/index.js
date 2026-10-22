import { Router } from "express";
import multer from "multer";
import mongoose from "mongoose";

import Event from "schemas/Events";
import RoosterFights from "schemas/RoosterFights";
import Roosters from "schemas/Roosters";
// import { extraerParticipantes } from "services/importarParticipantesPdf";
import {
  extraerPeleas,
  normalizarNombre,
  errorPdf,
} from "services/importarPeleasPdf";

const router = Router();

function firma(pelea) {
  return JSON.stringify({
    ronda: pelea.ronda,
    verde: String(pelea.verde),
    rojo: String(pelea.rojo),
    diferenciaGramos: pelea.diferenciaGramos,
  });
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
    fields: 0,
    parts: 1,
  },
});

// y autorización para administrar el evento.
router.post(
  "/:eventoId/fights/import",
  (req, res, next) => {
    upload.single("archivo")(req, res, (error) => {
      if (error) {
        return res.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({
          message:
            error.code === "LIMIT_FILE_SIZE"
              ? "El PDF no debe superar 5 MB."
              : "Envía un único PDF en el campo archivo.",
        });
      }

      next();
    });
  },
  async (req, res, next) => {
    try {
      let eventoId;
      try {
        eventoId = Event.schema.path("_id").cast(req.params.eventoId);
      } catch {
        throw errorPdf("Identificador de evento inválido.", 400);
      }
      if (!req.file)
        throw errorPdf("Falta el archivo PDF en la clave archivo.", 400);
      if (!(await Event.exists({ _id: eventoId })))
        throw errorPdf("El evento no existe.", 404);
      const filas = await extraerPeleas(req.file.buffer);
      console.log("🚀 ~ filas:", filas);

      async function preparar(session) {
        const numeros = [
          ...new Set(
            filas.flatMap((fila) => [
              fila.verde.numeroPdf,
              fila.rojo.numeroPdf,
            ]),
          ),
        ];

        const participantes = await Roosters.find({
          event: eventoId,
          numero: { $in: numeros },
        })
          .select("_id numero nombre")
          .session(session)
          .lean();
        const porNumero = new Map();
        for (const participante of participantes) {
          const lista = porNumero.get(participante.numero) || [];
          lista.push(participante);
          porNumero.set(participante.numero, lista);
        }
        const problemas = [];
        const documentos = filas.map((fila) => {
          const doc = {
            event: eventoId,
            cotejo: fila.cotejo,
            ronda: fila.ronda,
            diferenciaGramos: fila.diferenciaGramos,
          };
          for (const lado of ["verde", "rojo"]) {
            const coincidencias = porNumero.get(fila[lado].numeroPdf) || [];
            if (coincidencias.length !== 1)
              problemas.push({
                cotejo: fila.cotejo,
                lado,
                numero: fila[lado].numeroPdf,
                nombre: fila[lado].nombre,
                motivo: coincidencias.length
                  ? "Número de participante ambiguo en el evento."
                  : "Participante no registrado en el evento.",
              });
            else if (
              normalizarNombre(coincidencias[0].nombre) !==
              normalizarNombre(fila[lado].nombre)
            ) {
              problemas.push({
                cotejo: fila.cotejo,
                lado,
                numero: fila[lado].numeroPdf,
                nombrePdf: fila[lado].nombre,
                nombreRegistrado: coincidencias[0].nombre,
                motivo: "El número pertenece a otro participante.",
              });
            }
            doc[lado] = coincidencias[0]?._id;
          }
          if (
            doc.verde != null &&
            doc.rojo != null &&
            String(doc.verde) === String(doc.rojo)
          ) {
            problemas.push({
              cotejo: fila.cotejo,
              motivo: "Los dos lados corresponden al mismo participante.",
            });
          }
          return doc;
        });
        if (problemas.length)
          throw errorPdf(
            "Corrige los participantes antes de importar.",
            409,
            problemas,
          );
        const guardadas = await RoosterFights.find({ event: eventoId })
          .session(session)
          .lean();
        const porCotejo = new Map(guardadas.map((p) => [p.cotejo, p]));
        const nuevas = [],
          conflictos = [];
        for (const doc of documentos) {
          const anterior = porCotejo.get(doc.cotejo);
          if (!anterior) nuevas.push(doc);
          else if (firma(anterior) !== firma(doc)) conflictos.push(doc.cotejo);
        }
        if (conflictos.length)
          throw errorPdf(
            "Hay cotejos existentes con datos diferentes. No se sobrescribieron.",
            409,
            conflictos,
          );
        const resumenRondas = Object.fromEntries(
          [...new Set(filas.map((p) => p.ronda))].map((r) => [
            r,
            filas.filter((p) => p.ronda === r).length,
          ]),
        );
        return {
          nuevas,
          documentos,
          resumen: {
            totalDetectadas: filas.length,
            nuevas: nuevas.length,
            existentes: documentos.length - nuevas.length,
            rondas: resumenRondas,
          },
        };
      }

      if (req.query.preview === "true") {
        const plan = await preparar(null);
        return res.json({
          preview: true,
          ...plan.resumen,
          peleas: plan.documentos,
        });
      }
      // Una sola transacción: si una escritura falla, no queda un lote parcial.
      // Requiere Atlas o MongoDB replica set; modelos en la misma conexión.
      const resumen = await Event.db.transaction(async (session) => {
        if (!(await Event.exists({ _id: eventoId }).session(session)))
          throw errorPdf("El evento no existe.", 404);
        const plan = await preparar(session);
        if (plan.nuevas.length)
          // await RoosterFights.insertMany(plan.nuevas, {
          //   session,
          //   ordered: true,
          // });
          return { ...plan.resumen, importadas: plan.nuevas.length };
      });
      return res
        .status(resumen.importadas ? 201 : 200)
        .json({ message: "Importación completada.", ...resumen });
    } catch (error) {
      if (error.status)
        return res
          .status(error.status)
          .json({ message: error.message, detalles: error.detalles });
      if (error.code === 11000)
        return res.status(409).json({
          message: "Importación concurrente detectada; vuelve a intentar.",
        });
      next(error);
    }
  },
);

export default router;
