import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

function errorPdf(message) {
  const error = new Error(message);
  error.status = 422;
  return error;
}

export async function extraerParticipantes(buffer) {
  if (
    !Buffer.isBuffer(buffer) ||
    !buffer.subarray(0, 1024).includes(Buffer.from("%PDF-"))
  ) {
    throw errorPdf("El archivo recibido no es un PDF.");
  }

  const tarea = getDocument({
    data: new Uint8Array(buffer),
    isEvalSupported: false,
  });

  try {
    const pdf = await tarea.promise;

    if (pdf.numPages > 20) {
      throw errorPdf("El reporte supera el límite de 20 páginas.");
    }

    const participantes = new Map();

    for (let pagina = 1; pagina <= pdf.numPages; pagina++) {
      const page = await pdf.getPage(pagina);
      const { items } = await page.getTextContent();

      const textos = items
        .filter((item) => typeof item.str === "string" && item.str.trim())
        .map((item) => ({
          texto: item.str.trim(),
          x: item.transform[4],
          y: item.transform[5],
        }));

      const encabezado = textos.find(
        (item) => item.texto.toLowerCase() === "partido",
      );

      if (!encabezado) {
        throw errorPdf(
          `No se encontró la columna Partido en la página ${pagina}.`,
        );
      }

      // Coordenadas del formato adjunto, en puntos PDF:
      // número: x < 30; nombre: 30 <= x < 250.
      const numeros = textos.filter(
        (item) =>
          item.x < 30 && item.y < encabezado.y - 5 && /^\d+$/.test(item.texto),
      );

      if (!numeros.length) {
        throw errorPdf(
          `No se encontraron participantes en la página ${pagina}.`,
        );
      }

      for (const fila of numeros) {
        const numero = Number(fila.texto);

        const nombre = textos
          .filter(
            (item) =>
              item.x >= 30 && item.x < 250 && Math.abs(item.y - fila.y) <= 3,
          )
          .sort((a, b) => a.x - b.x)
          .map((item) => item.texto)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();

        if (!numero || !nombre) {
          throw errorPdf(`No se pudo leer el participante ${fila.texto}.`);
        }

        if (participantes.has(numero)) {
          throw errorPdf(`El número ${numero} aparece repetido en el reporte.`);
        }

        participantes.set(numero, { numero, nombre });
      }
    }

    return [...participantes.values()].sort((a, b) => a.numero - b.numero);
  } catch (error) {
    if (error.status === 422) throw error;
    throw errorPdf("No se pudo leer el PDF. Verifica que no esté protegido.");
  } finally {
    await tarea.destroy();
  }
}

// exports.importRoosters = async (req, res) => {
//   if (!req.file) {
//     return res.status(400).json({ message: "Selecciona un archivo PDF." });
//   }

//   try {
//     const participantes = await exports.extraerParticipantes(req.file.buffer);
//     return res.json({ participantes });
//   } catch (error) {
//     return res.status(error.status || 500).json({
//       message:
//         error.status === 422
//           ? error.message
//           : "No se pudo importar el reporte.",
//     });
//   }
// };
