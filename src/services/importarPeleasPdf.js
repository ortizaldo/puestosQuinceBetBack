import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export function errorPdf(message, status = 422, detalles) {
  const error = new Error(message);
  error.status = status;
  error.detalles = detalles;
  return error;
}

export function normalizarNombre(nombre) {
  return nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function agrupar(items) {
  const filas = [];
  for (const item of [...items].sort((a, b) => b.y - a.y || a.x - b.x)) {
    const ultima = filas.at(-1);
    if (ultima && Math.abs(ultima.y - item.y) <= 3) ultima.items.push(item);
    else filas.push({ y: item.y, items: [item] });
  }
  for (const fila of filas) fila.items.sort((a, b) => a.x - b.x);
  return filas;
}

// Exclusivo del formato Tuums adjunto: tamaño carta y estas columnas.
// Las páginas se procesan por separado; la ronda puede continuar en otra página.
export function interpretarPaginas(paginas) {
  const peleas = [];
  const vistos = new Set();
  for (const [pagina, items] of paginas.entries()) {
    let ronda = null;
    let actual = null;
    let encabezados = 0;
    for (const fila of agrupar(items)) {
      const texto = fila.items
        .map((i) => i.text)
        .join(" ")
        .trim();
      if (/\bPag\./i.test(texto)) {
        actual = null;
        continue;
      }
      const cabecera = texto.match(/^RONDA\s+(\d+)$/i);
      if (cabecera) {
        ronda = Number(cabecera[1]);
        actual = null;
        encabezados++;
        continue;
      }
      const numero = fila.items.find((i) => i.x < 30 && /^\d+$/.test(i.text));
      if (numero && ronda) {
        const cotejo = Number(numero.text);
        const cuerpo = fila.items
          .filter((i) => i.x >= 80 && i.x < 540)
          .map((i) => i.text)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
        const m = cuerpo.match(
          /^(\d+)\s*--\s*(.+?)\s+(\d+[.,]\d{3})\s+(\d+)\s+(\d+)\s+(\d+[.,]\d{3})\s*(\d+)\s*--\s*(.+)$/,
        );
        if (!m)
          throw errorPdf(
            `No se pudo leer el cotejo ${cotejo}, página ${pagina + 1}.`,
          );
        if (!cotejo || vistos.has(cotejo))
          throw errorPdf(`Cotejo inválido o repetido: ${cotejo}.`);
        const gramos = (v) => Number(v.replace(/[.,]/, ""));
        actual = {
          cotejo,
          ronda,
          verde: {
            numeroPdf: Number(m[1]),
            nombre: m[2].trim(),
            peso: gramos(m[3]),
            anillo: m[4],
          },
          rojo: {
            numeroPdf: Number(m[7]),
            nombre: m[8].trim(),
            peso: gramos(m[6]),
            anillo: m[5],
          },
        };
        if (
          !actual.verde.numeroPdf ||
          !actual.rojo.numeroPdf ||
          actual.verde.peso <= 0 ||
          actual.rojo.peso <= 0
        ) {
          throw errorPdf(`Datos inválidos en el cotejo ${cotejo}.`);
        }
        actual.diferenciaGramos = Math.abs(
          actual.verde.peso - actual.rojo.peso,
        );
        vistos.add(cotejo);
        peleas.push(actual);
        continue;
      }
      if (actual) {
        // Segundas líneas de los nombres; nunca columnas de resultado ni pie.
        for (const [lado, desde, hasta] of [
          ["verde", 80, 220],
          ["rojo", 395, 540],
        ]) {
          const continuacion = fila.items
            .filter((i) => i.x >= desde && i.x < hasta)
            .map((i) => i.text)
            .join(" ")
            .trim();
          if (continuacion) actual[lado].nombre += " " + continuacion;
        }
      }
    }
    if (!encabezados)
      throw errorPdf(
        `Página ${pagina + 1} sin encabezado RONDA; formato no reconocido.`,
      );
  }
  if (!peleas.length)
    throw errorPdf("El PDF no contiene peleas legibles. No se aplica OCR.");
  peleas.sort((a, b) => a.cotejo - b.cotejo);
  // Este formato enumera globalmente desde 1. Evita aceptar páginas faltantes.
  peleas.forEach((p, i) => {
    if (p.cotejo !== i + 1)
      throw errorPdf(`Falta el cotejo ${i + 1}; sube el reporte completo.`);
    if (normalizarNombre(p.verde.nombre) === normalizarNombre(p.rojo.nombre)) {
      throw errorPdf(`El cotejo ${p.cotejo} enfrenta al mismo participante.`);
    }
  });
  return peleas;
}

export async function extraerPeleas(buffer) {
  if (!buffer.subarray(0, 1024).includes(Buffer.from("%PDF-")))
    throw errorPdf("El archivo no es un PDF.");
  const tarea = getDocument({
    data: new Uint8Array(buffer),
    isEvalSupported: false,
  });
  try {
    const pdf = await tarea.promise;
    if (pdf.numPages > 20) throw errorPdf("Máximo 20 páginas.");
    const paginas = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const pagina = await pdf.getPage(n);
      const viewport = pagina.getViewport({ scale: 1 });
      if (
        Math.abs(viewport.width - 612) > 2 ||
        Math.abs(viewport.height - 792) > 2 ||
        pagina.rotate !== 0
      ) {
        throw errorPdf(
          `Página ${n}: se esperaba formato carta vertical sin rotación.`,
        );
      }
      const { items } = await pagina.getTextContent();
      paginas.push(
        items
          .filter((i) => i.str?.trim())
          .map((i) => ({
            text: i.str.trim(),
            x: i.transform[4],
            y: i.transform[5],
          })),
      );
    }
    return interpretarPaginas(paginas);
  } catch (error) {
    if (error.status) throw error;
    throw errorPdf(
      "No se pudo leer el PDF. Verifica que no esté dañado o protegido.",
    );
  } finally {
    await tarea.destroy();
  }
}
