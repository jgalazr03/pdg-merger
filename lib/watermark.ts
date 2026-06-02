// Estampado de marca de agua de texto en PDFs, 100% en el navegador (pdf-lib).
// Lógica pura extraída de Watermarker para poder procesar por lotes con los
// mismos ajustes en todos los archivos.

export interface WatermarkParams {
  text: string;
  /** Opacidad en porcentaje (0-100). */
  opacity: number;
  /** Rotación en grados. */
  rotation: number;
  /** Tamaño de fuente en puntos. */
  fontSize: number;
  /** Color RGB con componentes en 0..1. */
  color: [number, number, number];
  /** Rango de páginas tipo "1-3,5,8-10". Vacío = todas. */
  pageRange: string;
}

function clampNumber(value: number, min: number, max: number, fallback: number) {
  if (Number.isNaN(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

/**
 * Convierte un rango "1-3,5,8-10" en un Set de índices base 0 acotado a `total`.
 * Devuelve null cuando el texto está vacío (= todas las páginas). Si el texto no
 * está vacío pero ningún índice cae dentro del documento, devuelve un Set vacío
 * (ninguna página de ESE archivo se marca).
 */
export function parsePageRange(spec: string, total: number): Set<number> | null {
  const trimmed = spec.trim();
  if (!trimmed) return null;
  const set = new Set<number>();
  for (const part of trimmed.split(',')) {
    const p = part.trim();
    if (!p) continue;
    const range = p.match(/^(\d+)\s*-\s*(\d+)$/);
    if (range) {
      let a = parseInt(range[1], 10);
      let b = parseInt(range[2], 10);
      if (a > b) [a, b] = [b, a];
      for (let i = a; i <= b; i++) {
        if (i >= 1 && i <= total) set.add(i - 1);
      }
    } else if (/^\d+$/.test(p)) {
      const i = parseInt(p, 10);
      if (i >= 1 && i <= total) set.add(i - 1);
    }
  }
  return set;
}

export async function watermarkPdf(
  file: File,
  params: WatermarkParams,
  onProgress?: (pct: number) => void
): Promise<Blob> {
  const { PDFDocument, StandardFonts, degrees, rgb } = await import('pdf-lib');
  const pdf = await PDFDocument.load(await file.arrayBuffer());
  const font = await pdf.embedFont(StandardFonts.HelveticaBold);

  const op = clampNumber(params.opacity, 0, 100, 30) / 100;
  const rot = clampNumber(params.rotation, -360, 360, 45);
  const size = clampNumber(params.fontSize, 6, 400, 50);
  const rad = (rot * Math.PI) / 180;
  const label = params.text.trim();
  const [r, g, b] = params.color;

  const textWidth = font.widthOfTextAtSize(label, size);
  const textHeight = font.heightAtSize(size);

  const pages = pdf.getPages();
  const range = parsePageRange(params.pageRange, pages.length);

  pages.forEach((page, index) => {
    if (!range || range.has(index)) {
      const { width, height } = page.getSize();
      // Punto de anclaje del texto para que el centro de la cadena (girada en
      // torno a ese punto) caiga en el centro de la página.
      const x =
        width / 2 -
        (textWidth / 2) * Math.cos(rad) +
        (textHeight / 2) * Math.sin(rad);
      const y =
        height / 2 -
        (textWidth / 2) * Math.sin(rad) -
        (textHeight / 2) * Math.cos(rad);

      page.drawText(label, {
        x,
        y,
        size,
        font,
        color: rgb(r, g, b),
        opacity: op,
        rotate: degrees(rot),
      });
    }
    onProgress?.(Math.round(((index + 1) / pages.length) * 100));
  });

  const bytes = await pdf.save();
  return new Blob([bytes], { type: 'application/pdf' });
}
