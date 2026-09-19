const express = require("express");
const multer = require("multer");
const { v2: cloudinary } = require("cloudinary");
import Event from "schemas/Events";

const router = express.Router();

// cloudinary.config({
//   cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
//   api_key: process.env.CLOUDINARY_API_KEY,
//   api_secret: process.env.CLOUDINARY_API_SECRET,
// });

exports.upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];

    if (!allowed.includes(file.mimetype)) {
      return callback(new Error("Solo se permiten imágenes JPG, PNG o WebP"));
    }

    callback(null, true);
  },
});

function uploadToCloudinary(fileBuffer) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "la-angostura/events",
        resource_type: "image",
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      },
    );

    stream.end(fileBuffer);
  });
}

exports.uploadImage = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "Selecciona un flyer" });
  }

  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ message: "Evento no encontrado" });
    }

    const result = await uploadToCloudinary(req.file.buffer);
    const previousPublicId = event.flyer?.publicId;

    event.flyer = {
      url: result.secure_url,
      publicId: result.public_id,
    };

    try {
      await event.save();
    } catch (error) {
      // Evita dejar una imagen nueva sin referencia si falla MongoDB.
      await cloudinary.uploader.destroy(result.public_id);
      throw error;
    }

    // El flyer anterior se elimina solo después de guardar el nuevo.
    if (previousPublicId) {
      try {
        await cloudinary.uploader.destroy(previousPublicId);
      } catch (error) {
        console.error("No se pudo eliminar el flyer anterior:", error);
      }
    }

    return res.json({ flyer: event.flyer });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "No se pudo subir el flyer" });
  }
};
