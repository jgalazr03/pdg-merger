// Numeración de páginas en PDFs, 100% en el navegador (pdf-lib). Lógica pura
// extraída de PageNumberer para poder procesar por lotes con los mismos ajustes
// en todos los archivos.

export type Position =
  | 'inferior-centro'
  | 'inferior-derecha'
  | 'inferior-izquierda'
  | 'superior-centro'
  | 'superior-derecha'
  | 'superior-izquierda';

export type Format = 'simple' | 'fraccion' | 'pagina';

export interface PageNumberParams {
  position: Position;
  format: Format;
  /** Página desde la que empezar a numerar (1 = todas). */
  startFrom: number;
}

const MARGIN = 20;

function buildLabel(format: Format, current: number, total: number): string {
  switch (format) {
    case 'fraccion':
      return `${current} / ${total}`;
    case 'pagina':
      return `Página ${current} de ${total}`;
    default:
      return `${current}`;
  }
}

export async function numberPdf(
  file: File,
  params: PageNumberParams,
  onProgress?: (pct: number) => void
): Promise<Blob> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const pdf = await PDFDocument.load(await file.arrayBuffer());
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const navy = rgb(0.09, 0.13, 0.24);
  const size = 11;

  const start = Math.max(1, Math.floor(params.startFrom) || 1);
  const pages = pdf.getPages();
  // Total de páginas que efectivamente se numeran (desde `start`).
  const numberedTotal = Math.max(0, pages.length - (start - 1));

  pages.forEach((page, index) => {
    const pageNumber = index + 1;
    if (pageNumber >= start) {
      const current = pageNumber - (start - 1);
      const label = buildLabel(params.format, current, numberedTotal);
      const { width, height } = page.getSize();
      const textWidth = font.widthOfTextAtSize(label, size);

      const isTop = params.position.startsWith('superior');
      const y = isTop ? height - MARGIN - size : MARGIN;

      let x: number;
      if (params.position.endsWith('izquierda')) {
        x = MARGIN;
      } else if (params.position.endsWith('derecha')) {
        x = width - MARGIN - textWidth;
      } else {
        x = (width - textWidth) / 2;
      }

      page.drawText(label, { x, y, size, font, color: navy });
    }
    onProgress?.(Math.round(((index + 1) / pages.length) * 100));
  });

  const bytes = await pdf.save();
  return new Blob([bytes], { type: 'application/pdf' });
}
