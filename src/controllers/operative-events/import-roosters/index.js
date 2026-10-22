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
  "/eventos/:eventoId/peleas/importar",
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

      if (conflictos.length) {
        return res.status(409).json({
          message:
            "Hay números registrados con otro nombre. Corrige el PDF o los datos existentes.",
          conflictos,
        });
      }

      // Conserva los IDs existentes porque las peleas los referencian.
      const registros = nuevos.map((item) => ({
        event: eventoId,
        numero: item.numero,
        nombre: item.nombre,
      }));
      const insertados = registros.length
        ? await Roosters.insertMany(registros, { ordered: true })
        : [];
      const importados = insertados.length;

      return res.status(importados ? 201 : 200).json({
        message: "Importación completada.",
        totalDetectados: participantes.length,
        importados,
        existentes: existentes.length,
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
