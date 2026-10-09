import { Router } from "express";
import multer from "multer";
import mongoose from "mongoose";

import Event from "schemas/Events";
import Roosters from "schemas/Roosters";
import { extraerParticipantes } from "services/importarParticipantesPdf";

const router = Router();

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
  "/:eventoId/participantes/importar",
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
      const { eventoId } = req.params;

      if (!mongoose.isObjectIdOrHexString(eventoId)) {
        return res.status(400).json({
          message: "El identificador del evento no es válido.",
        });
      }

      if (!req.file) {
        return res.status(400).json({
          message: "Debes adjuntar el PDF en el campo archivo.",
        });
      }

      if (!(await Event.exists({ _id: eventoId }))) {
        return res.status(404).json({
          message: "El evento no existe.",
        });
      }

      const participantes = await extraerParticipantes(req.file.buffer);

      const existentes = await Roosters.find({
        event: eventoId,
        numero: { $in: participantes.map((item) => item.numero) },
      })
        .select("numero nombre")
        .lean();

      const porNumero = new Map(existentes.map((item) => [item.numero, item]));

      const nuevos = participantes.filter(
        (item) => !porNumero.has(item.numero),
      );

      const conflictos = participantes
        .filter(
          (item) =>
            porNumero.has(item.numero) &&
            porNumero.get(item.numero).nombre !== item.nombre,
        )
        .map((item) => ({
          numero: item.numero,
          nombreActual: porNumero.get(item.numero).nombre,
          nombrePdf: item.nombre,
        }));

      if (req.query.preview === "true") {
        return res.json({
          totalDetectados: participantes.length,
          nuevos: nuevos.length,
          existentes: existentes.length,
          conflictos,
          participantes,
        });
      }

      // $setOnInsert mantiene los registros existentes.
      // El índice único también protege ante peticiones concurrentes.
      let importados = 0;

      if (nuevos.length) {
        const resultado = await Roosters.bulkWrite(
          nuevos.map((item) => ({
            updateOne: {
              filter: {
                event: eventoId,
                numero: item.numero,
              },
              update: {
                $setOnInsert: {
                  event: eventoId,
                  numero: item.numero,
                  nombre: item.nombre,
                },
              },
              upsert: true,
            },
          })),
          { ordered: true },
        );

        importados = resultado.upsertedCount;
      }

      return res.status(importados ? 201 : 200).json({
        message: "Importación completada.",
        totalDetectados: participantes.length,
        importados,
        omitidos: participantes.length - importados,
        conflictos,
      });
    } catch (error) {
      if (error.status === 422) {
        return res.status(422).json({ message: error.message });
      }

      // Una escritura puede haberse completado parcialmente.
      // Reintentar es seguro por el índice y $setOnInsert.
      next(error);
    }
  },
);

export default router;
