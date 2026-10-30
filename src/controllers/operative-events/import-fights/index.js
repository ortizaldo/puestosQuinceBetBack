import { Router } from "express";
import multer from "multer";
import mongoose from "mongoose";

import Event from "schemas/Events";
import RoosterFights from "schemas/RoosterFights";
import Roosters from "schemas/Roosters";
import { publishRealtimeChange } from "../../../modules/realtime";
// import { extraerParticipantes } from "services/importarParticipantesPdf";
import {
  extraerPeleas,
  normalizarNombre,
  errorPdf,
} from "services/importarPeleasPdf";

const router = Router();

function idDe(valor) {
  if (valor == null) return null;
  return String(valor._id ?? valor);
}

function firma(pelea) {
  return JSON.stringify({
    ronda: pelea.ronda,
    verde: idDe(pelea.verde),
    rojo: idDe(pelea.rojo),
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
  "/eventos/:eventoId/fights/import",
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

      async function preparar(session) {
        // 1) Trae TODOS los participantes del evento (suelen ser decenas/cientos)
        const participantes = await Roosters.find({ event: eventoId })
          .select("_id numero nombre")
          .session(session)
          .lean();

        // 2) Indexa por nombre normalizado (lowercase, sin tildes, trim…)
        const porNombre = new Map();
        for (const p of participantes) {
          const clave = normalizarNombre(p.nombre);
          const lista = porNombre.get(clave) || [];
          lista.push(p);
          porNombre.set(clave, lista);
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
            const clave = normalizarNombre(fila[lado].nombre);
            const coincidencias = porNombre.get(clave) || [];

            if (coincidencias.length !== 1) {
              problemas.push({
                cotejo: fila.cotejo,
                lado,
                numero: fila[lado].numeroPdf,
                nombre: fila[lado].nombre,
                motivo: coincidencias.length
                  ? "Nombre de participante ambiguo en el evento."
                  : "Participante no registrado en el evento.",
              });
              continue;
            }

            const participante = coincidencias[0];

            // 3) Validar que el número del PDF corresponda al mismo gallo
            if (
              fila[lado].numeroPdf != null &&
              String(participante.numero) !== String(fila[lado].numeroPdf)
            ) {
              problemas.push({
                cotejo: fila.cotejo,
                lado,
                numeroPdf: fila[lado].numeroPdf,
                nombrePdf: fila[lado].nombre,
                nombreRegistrado: participante.nombre,
                numeroRegistrado: participante.numero,
                motivo:
                  "El número del PDF no coincide con el registrado para ese nombre.",
              });
              continue;
            }

            doc[lado] = {
              _id: participante._id,
              peso: fila[lado].peso ?? 0,
              anillo: fila[lado].anillo ?? 0,
            };
          }

          if (
            doc.verde != null &&
            doc.rojo != null &&
            idDe(doc.verde) === idDe(doc.rojo)
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

        const nuevas = [];
        const conflictos = [];
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

        return {
          nuevas,
          documentos,
          resumen: {
            totalDetectadas: filas.length,
            nuevas: nuevas.length,
            existentes: documentos.length - nuevas.length,
          },
        };
      }

      const plan = await preparar(null);

      if (plan.nuevas.length) {
        await RoosterFights.insertMany(plan.nuevas, { ordered: true });
        publishRealtimeChange("fights", "imported");
      }

      const resumen = {
        totalDetectadas: plan.resumen.totalDetectadas,
        nuevas: plan.resumen.nuevas,
        existentes: plan.resumen.existentes,
        importadas: plan.nuevas.length,
      };
      return res.status(200).json({
        message: "Importación completada.",
        resumen,
        importadas: resumen.importadas || 0,
      });
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
