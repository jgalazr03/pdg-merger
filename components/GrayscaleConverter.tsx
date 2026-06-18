'use client';

import { Contrast } from 'lucide-react';
import { getTool } from '@/lib/tools';
import { useBatchProcessor } from '@/hooks/use-batch-processor';
import ToolShell from '@/components/tools/ToolShell';
import FileDropzone from '@/components/tools/FileDropzone';
import ToolConstraints from '@/components/tools/ToolConstraints';
import BatchPanel from '@/components/tools/BatchPanel';

const tool = getTool('escala-grises');
const accent = tool.accent;

// Escala de rasterizado: 2x para nitidez sin disparar la memoria.
const RENDER_SCALE = 2;
const JPEG_QUALITY = 0.85;

const isPdf = (f: File) =>
  f.type === 'application/pdf' || /\.pdf$/i.test(f.name);

// Carga perezosa y memoizada de pdfjs-dist; configura el worker una sola vez.
let pdfjsPromise: Promise<typeof import('pdfjs-dist')> | null = null;
const loadPdfjs = async () => {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist').then((mod) => {
      mod.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
      return mod;
    });
  }
  return pdfjsPromise;
};

async function grayscalePdf(
  file: File,
  onProgress: (pct: number) => void
): Promise<Blob> {
  const [pdfjsLib, { PDFDocument }] = await Promise.all([
    loadPdfjs(),
    import('pdf-lib'),
  ]);

  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() })
    .promise;
  const newPdf = await PDFDocument.create();

  // Detección por prototipo para no estrechar el tipo de `context` a `never`.
  const supportsFilter =
    typeof CanvasRenderingContext2D !== 'undefined' &&
    'filter' in CanvasRenderingContext2D.prototype;

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: RENDER_SCALE });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    // Fondo blanco para PDFs con transparencia.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    if (supportsFilter) context.filter = 'grayscale(1)';

    await page.render({ canvasContext: context, viewport }).promise;

    if (!supportsFilter) {
      // Fallback: convierte a grises recorriendo los píxeles (luma BT.601).
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        data[i] = gray;
        data[i + 1] = gray;
        data[i + 2] = gray;
      }
      context.putImageData(imageData, 0, 0);
    }

    const imageDataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
    const imageBytes = Uint8Array.from(atob(imageDataUrl.split(',')[1]), (c) =>
      c.charCodeAt(0)
    );
    const image = await newPdf.embedJpg(imageBytes);

    // Tamaño de página = tamaño original (en puntos), no el rasterizado.
    const pageWidth = viewport.width / RENDER_SCALE;
    const pageHeight = viewport.height / RENDER_SCALE;
    newPdf
      .addPage([pageWidth, pageHeight])
      .drawImage(image, { x: 0, y: 0, width: pageWidth, height: pageHeight });

    // Libera el canvas antes de la siguiente página.
    canvas.width = 0;
    canvas.height = 0;
    onProgress(Math.round((pageNum / pdf.numPages) * 100));
  }

  const bytes = await newPdf.save();
  return new Blob([bytes], { type: 'application/pdf' });
}

export default function GrayscaleConverter() {
  const batch = useBatchProcessor({
    accept: isPdf,
    process: grayscalePdf,
    outName: (f) => `${f.name.replace(/\.pdf$/i, '')}_grises.pdf`,
    zipName: 'pdfs-grises.zip',
    rejectMessage: 'Solo se aceptan archivos PDF',
  });

  const step: 1 | 2 | 3 =
    batch.items.length === 0 ? 1 : batch.doneCount > 0 ? 3 : 2;

  return (
    <ToolShell tool={tool} step={step}>
      <FileDropzone
        className="mb-4"
        accent={accent}
        loaded={step > 1}
        accept=".pdf,application/pdf"
        multiple
        idleTitle="Selecciona archivos PDF"
        idleSubtitle="Haz clic o arrastra uno o varios PDF para pasarlos a escala de grises"
        dragTitle="Suelta los archivos aquí"
        buttonLabel="Seleccionar archivos"
        ariaLabel="Seleccionar o arrastrar archivos PDF"
        onFiles={batch.addFiles}
      />

      <ToolConstraints items={tool.constraints} />

      <BatchPanel
        items={batch.items}
        accent={accent}
        isProcessing={batch.isProcessing}
        done={batch.done}
        doneCount={batch.doneCount}
        errorCount={batch.errorCount}
        actionLabel="Convertir a grises"
        actioningLabel="Convirtiendo…"
        ActionIcon={Contrast}
        onRun={batch.run}
        onRemove={batch.removeItem}
        onReset={batch.reset}
        onDownloadAll={batch.downloadAll}
        onDownloadOne={batch.downloadOne}
        resultHint="Cada página quedó rasterizada en grises (el texto deja de ser seleccionable)."
      />
    </ToolShell>
  );
}
