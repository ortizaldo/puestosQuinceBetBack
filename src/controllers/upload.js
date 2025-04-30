import { resError, db } from "modules";

import _ from "underscore";

exports.upload = async (req, res) => {
    let err = {
      code: 422,
      title: "Upload CSV",
      message: "Error al cargar el archivo",
    };
    try {
        if (!req.file) {
            return res.status(400).send('No se subió ningún archivo.');
        }

        console.log('Archivo recibido:', req.file.originalname);
        // Aquí puedes procesar el archivo CSV, por ejemplo convertirlo a texto:
        const csvContent = req.file.buffer.toString('utf-8');
        console.log(csvContent);

        res.send({ message: 'Archivo subido correctamente.' });
    } catch (error) {
      resError(res, error);
    }
  };