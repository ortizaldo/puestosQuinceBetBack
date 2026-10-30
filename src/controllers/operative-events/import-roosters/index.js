import { Router } from "express";
import multer from "multer";
import mongoose from "mongoose";

import Event from "schemas/Events";
import Roosters from "schemas/Roosters";
import { publishRealtimeChange } from "../../../modules/realtime";
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

      const nombresVistos = new Set();
      const nombresDuplicadosPdf = new Set();
      for (const item of participantes) {
        if (nombresVistos.has(item.nombre))
          nombresDuplicadosPdf.add(item.nombre);
        nombresVistos.add(item.nombre);
      }
      const nombresEnOtroEvento = await Roosters.find({
        event: { $ne: eventoId },
        nombre: { $in: participantes.map((item) => item.nombre) },
      }).distinct("nombre");

      if (req.query.preview === "true") {
        return res.json({
          totalDetectados: participantes.length,
          nuevos: nuevos.length,
          existentes: existentes.length,
          conflictos,
          nombresDuplicadosPdf: [...nombresDuplicadosPdf],
          nombresEnOtroEvento,
          participantes,
        });
      }

      if (nombresDuplicadosPdf.size || nombresEnOtroEvento.length) {
        return res.status(409).json({
          message:
            "No se puede reemplazar la lista porque hay nombres duplicados.",
          nombresDuplicadosPdf: [...nombresDuplicadosPdf],
          nombresEnOtroEvento,
        });
      }

      // La importación reemplaza la lista completa del evento con lo leído del PDF.
      const eliminados = await Roosters.deleteMany({ event: eventoId });
      const registros = participantes.map((item) => ({
        event: eventoId,
        numero: item.numero,
        nombre: item.nombre,
      }));
      const insertados = registros.length
        ? await Roosters.insertMany(registros, { ordered: true })
        : [];
      const importados = insertados.length;

      if (eliminados.deletedCount || importados) {
        publishRealtimeChange("participants", "imported");
      }

      return res.status(importados ? 201 : 200).json({
        message: "Importación completada.",
        totalDetectados: participantes.length,
        eliminados: eliminados.deletedCount,
        importados,
        omitidos: 0,
        conflictos,
      });
    } catch (error) {
      if (error.status === 422) {
        return res.status(422).json({ message: error.message });
      }

      next(error);
    }
  },
);

export default router;
