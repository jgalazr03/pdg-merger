'use client';

import { useState, useRef, useEffect } from 'react';
import { Download, Loader2, X, FileText, Contrast } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn, scrollIntoViewSafe } from '@/lib/utils';
import { toastUndo } from '@/lib/toast';
import { getTool } from '@/lib/tools';
import ToolShell from '@/components/tools/ToolShell';
import FileDropzone from '@/components/tools/FileDropzone';
import ToolConstraints from '@/components/tools/ToolConstraints';

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

// Escala de rasterizado: 2x para nitidez sin disparar la memoria.
const RENDER_SCALE = 2;
const JPEG_QUALITY = 0.85;

const tool = getTool('escala-grises');
const accent = tool.accent;

interface ResultPDF {
  blob: Blob;
  name: string;
  pages: number;
}

export default function GrayscaleConverter() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ResultPDF | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (result) {
      setTimeout(() => scrollIntoViewSafe(resultRef.current), 100);
    }
  }, [result]);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleFileSelect = (file: File) => {
    if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) {
      toast.error('Archivo no válido', {
        description: 'Por favor selecciona un archivo PDF.',
      });
      return;
    }
    setSelectedFile(file);
    setResult(null);
    setProgress(0);
  };

  const convertToGrayscale = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setProgress(0);
    try {
      const [pdfjsLib, { PDFDocument }] = await Promise.all([
        loadPdfjs(),
        import('pdf-lib'),
      ]);

      const arrayBuffer = await selectedFile.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const newPdf = await PDFDocument.create();

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

        // Filtro de grises antes de renderizar (cae a recorrido de píxeles si
        // el navegador no soporta ctx.filter). Detección por prototipo para no
        // estrechar el tipo de `context` (un `in` sobre la instancia lo dejaría
        // en `never` para TypeScript).
        const supportsFilter =
          typeof CanvasRenderingContext2D !== 'undefined' &&
          'filter' in CanvasRenderingContext2D.prototype;
        if (supportsFilter) {
          context.filter = 'grayscale(1)';
        }

        await page.render({
          canvasContext: context,
          viewport,
        }).promise;

        if (!supportsFilter) {
          // Fallback: convierte a grises recorriendo los píxeles (luma BT.601).
          const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          for (let i = 0; i < data.length; i += 4) {
            const gray =
              data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
            data[i] = gray;
            data[i + 1] = gray;
            data[i + 2] = gray;
          }
          context.putImageData(imageData, 0, 0);
        }

        const imageDataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
        const imageBytes = Uint8Array.from(
          atob(imageDataUrl.split(',')[1]),
          (c) => c.charCodeAt(0)
        );

        const image = await newPdf.embedJpg(imageBytes);
        // Tamaño de página = tamaño original (en puntos), no el rasterizado.
        const pageWidth = viewport.width / RENDER_SCALE;
        const pageHeight = viewport.height / RENDER_SCALE;
        const pdfPage = newPdf.addPage([pageWidth, pageHeight]);
        pdfPage.drawImage(image, {
          x: 0,
          y: 0,
          width: pageWidth,
          height: pageHeight,
        });

        // Libera el canvas antes de la siguiente página.
        canvas.width = 0;
        canvas.height = 0;

        setProgress(Math.round((pageNum / pdf.numPages) * 100));
      }

      const pdfBytes = await newPdf.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });

      setResult({
        blob,
        name: selectedFile.name.replace(/\.pdf$/i, '') + '_grises.pdf',
        pages: pdf.numPages,
      });
      toast.success('PDF convertido a escala de grises', {
        description: `${pdf.numPages} página${pdf.numPages !== 1 ? 's' : ''} procesada${pdf.numPages !== 1 ? 's' : ''}.`,
      });
    } catch (error) {
      console.error('Error converting to grayscale:', error);
      toast.error('No se pudo convertir el PDF', {
        description: 'Asegúrate de que sea un PDF válido e inténtalo de nuevo.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadPDF = () => {
    if (!result) return;
    const url = URL.createObjectURL(result.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = result.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const resetAll = () => {
    setSelectedFile(null);
    setResult(null);
    setProgress(0);
  };

  const changeFileWithUndo = () => {
    if (!selectedFile) return;
    const snap = { selectedFile, result };
    resetAll();
    toastUndo('Archivo descartado', {
      description: 'Selecciona otro PDF, o recupéralo si fue un error.',
      onUndo: () => {
        setSelectedFile(snap.selectedFile);
        setResult(snap.result);
      },
    });
  };

  const step: 1 | 2 | 3 = !selectedFile ? 1 : result ? 3 : 2;

  return (
    <ToolShell tool={tool} step={step}>
      <FileDropzone
        className="mb-4"
        accent={accent}
        accept=".pdf,application/pdf"
        idleTitle="Selecciona un archivo PDF"
        idleSubtitle="Haz clic aquí o arrastra y suelta tu archivo PDF"
        dragTitle="Suelta el archivo PDF aquí"
        buttonLabel="Seleccionar archivo"
        ariaLabel="Seleccionar o arrastrar un archivo PDF"
        onFiles={(files) => handleFileSelect(files[0])}
      />

      <ToolConstraints items={tool.constraints} />

      {selectedFile && (
        <Card className="mb-8 motion-safe:animate-slide-up">
          <CardContent className="p-4 sm:p-6">
            <div className="mb-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="font-display text-lg font-bold text-ink">
                Archivo seleccionado
              </h2>
              <Button
                variant="outline"
                size="sm"
                onClick={changeFileWithUndo}
                className="shrink-0"
              >
                <X className="mr-2 h-4 w-4" />
                Cambiar archivo
              </Button>
            </div>

            <div className="flex items-center gap-4 rounded-lg border-3 border-ink bg-surface p-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded border-2 border-ink bg-card">
                <FileText className="h-6 w-6 text-ink" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink">{selectedFile.name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatFileSize(selectedFile.size)}
                </p>
              </div>
            </div>

            <div className={cn('mt-6 rounded-lg border-3 border-ink p-3', accent.soft)}>
              <p className={cn('text-sm', accent.softText)}>
                Cada página se rasteriza en escala de grises: el texto deja de ser
                seleccionable porque se convierte en imagen.
              </p>
            </div>

            {isProcessing && (
              <div className="mt-6 space-y-2" aria-live="polite">
                <div className="flex items-center justify-between text-sm">
                  <span className={accent.text}>Convirtiendo páginas…</span>
                  <span className="text-muted-foreground">{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {selectedFile && !result && (
        <Card className="mb-8">
          <CardContent className="p-4 text-center sm:p-6">
            <h2 className="mb-4 font-display text-lg font-bold text-ink">
              ¿Listo para convertir?
            </h2>
            <p className="mb-6 text-muted-foreground">
              Se generará un PDF nuevo con todas las páginas en escala de grises.
            </p>
            <Button
              onClick={convertToGrayscale}
              disabled={isProcessing}
              aria-busy={isProcessing}
              size="lg"
              className={accent.solid}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Convirtiendo…
                </>
              ) : (
                <>
                  <Contrast className="mr-2 h-5 w-5" />
                  Convertir a grises
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card ref={resultRef} className="motion-safe:animate-slide-up">
          <CardContent className="p-4 text-center sm:p-6">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full border-3 border-ink bg-success text-white">
              <Download className="h-8 w-8" />
            </div>
            <h2 className="mb-2 text-lg font-bold text-success">
              ¡Conversión completada!
            </h2>
            <p className="mb-6 text-ink">
              Tu PDF en escala de grises tiene {result.pages} página
              {result.pages !== 1 ? 's' : ''} ({formatFileSize(result.blob.size)}).
            </p>
            <div className="mb-6 flex items-center justify-center gap-3 rounded-lg border-3 border-ink bg-surface p-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded border-2 border-ink bg-success text-white">
                <FileText className="h-5 w-5" />
              </div>
              <span className="truncate text-sm font-medium text-ink">
                {result.name}
              </span>
            </div>
            <div className="flex flex-col justify-center gap-3 sm:flex-row">
              <Button onClick={downloadPDF} size="lg" className={accent.solid}>
                <Download className="mr-2 h-5 w-5" />
                Descargar PDF
              </Button>
              <Button variant="outline" onClick={resetAll} size="lg">
                Convertir otro PDF
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </ToolShell>
  );
}
