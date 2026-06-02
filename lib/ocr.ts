// Helper client-only de OCR con tesseract.js. Los assets (worker, core wasm y
// modelo de español) se sirven autoalojados desde /public/tesseract (ver
// scripts/copy-tesseract.js); NO se importan por el bundler. Produce un PDF
// BUSCABLE (imagen + capa de texto invisible, vía el renderer nativo de
// Tesseract en WASM) y el texto plano, en una sola pasada por página.

const TESS_OPTS = {
  workerPath: '/tesseract/worker.min.js',
  corePath: '/tesseract/core', // directorio con las variantes *.wasm.js
  langPath: '/tesseract/lang', // resuelve langPath + '/spa.traineddata.gz'
};

// Resolución de rasterizado del PDF: a mayor escala, mejor OCR (a costa de RAM).
const RENDER_SCALE = 2;

const isPdf = (file: File) =>
  file.type === 'application/pdf' || /\.pdf$/i.test(file.name);

let pdfjsPromise: Promise<typeof import('pdfjs-dist')> | null = null;
async function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist').then((mod) => {
      mod.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
      return mod;
    });
  }
  return pdfjsPromise;
}

export interface OcrResult {
  pdfBlob: Blob;
  text: string;
  pages: number;
}

/**
 * Reconoce el texto de una imagen o de un PDF escaneado y devuelve un PDF
 * buscable + el texto. Reutiliza un único worker para todas las páginas.
 */
export async function ocrFile(
  file: File,
  onProgress?: (pct: number) => void
): Promise<OcrResult> {
  // Estado compartido con el logger para calcular el progreso global (varias
  // páginas): el worker reporta 0-100 por página; lo escalamos al total.
  const state = { page: 1, pages: 1 };

  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('spa', 1, {
    ...TESS_OPTS,
    logger: (m: { status: string; progress: number }) => {
      if (onProgress && m.status === 'recognizing text') {
        const overall = (state.page - 1 + m.progress) / state.pages;
        onProgress(Math.round(overall * 100));
      }
    },
  });

  try {
    // Imagen suelta: una sola página.
    if (!isPdf(file)) {
      const { data } = await worker.recognize(file, {}, { pdf: true, text: true });
      return {
        pdfBlob: new Blob([new Uint8Array(data.pdf ?? [])], {
          type: 'application/pdf',
        }),
        text: data.text ?? '',
        pages: 1,
      };
    }

    // PDF: rasterizar cada página y reconocer; unir los PDF por página.
    const pdfjs = await loadPdfjs();
    const { PDFDocument } = await import('pdf-lib');
    const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() })
      .promise;
    state.pages = doc.numPages;
    const merged = await PDFDocument.create();
    const texts: string[] = [];

    for (let n = 1; n <= doc.numPages; n++) {
      state.page = n;
      const page = await doc.getPage(n);
      const viewport = page.getViewport({ scale: RENDER_SCALE });
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;

      const { data } = await worker.recognize(canvas, {}, { pdf: true, text: true });
      texts.push(data.text ?? '');

      const pagePdf = await PDFDocument.load(new Uint8Array(data.pdf ?? []));
      const copied = await merged.copyPages(pagePdf, pagePdf.getPageIndices());
      copied.forEach((p) => merged.addPage(p));

      // Libera el canvas antes de la siguiente página.
      canvas.width = 0;
      canvas.height = 0;
    }

    const bytes = await merged.save();
    return {
      pdfBlob: new Blob([bytes], { type: 'application/pdf' }),
      text: texts.join('\n\n'),
      pages: doc.numPages,
    };
  } finally {
    await worker.terminate();
  }
}
