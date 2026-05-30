'use client';

import { useState, useRef, useEffect } from 'react';
import {
  FileText,
  Download,
  Loader2,
  X,
  RotateCw,
  RotateCcw,
} from 'lucide-react';
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

const tool = getTool('girar');
const accent = tool.accent;

// Carga perezosa y memoizada de pdfjs-dist (solo para las miniaturas); configura
// el worker una sola vez. pdf-lib (el giro real, sin pérdida) se importa aparte
// al aplicar. Así la herramienta abre al instante.
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

interface PageItem {
  pageNumber: number;
  thumbnail: string; // data URL
  rotation: number; // delta a aplicar: 0 | 90 | 180 | 270
}

const norm = (deg: number) => ((deg % 360) + 360) % 360;

export default function PDFRotator() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pages, setPages] = useState<PageItem[]>([]);
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (pages.length > 0 && !downloadUrl) {
      setTimeout(() => scrollIntoViewSafe(editorRef.current), 100);
    }
  }, [pages.length, downloadUrl]);

  useEffect(() => {
    if (downloadUrl) {
      setTimeout(() => scrollIntoViewSafe(resultRef.current), 100);
    }
  }, [downloadUrl]);

  // Libera el object URL del resultado al desmontar / regenerar.
  useEffect(() => {
    return () => {
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    };
  }, [downloadUrl]);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const baseName = (): string =>
    selectedFile ? selectedFile.name.replace(/\.pdf$/i, '') : 'documento';

  const handleFileSelect = async (file: File) => {
    if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) {
      toast.error('Archivo no válido', {
        description: 'Por favor selecciona un archivo PDF.',
      });
      return;
    }

    setSelectedFile(file);
    setDownloadUrl(null);
    setPages([]);
    setIsRendering(true);
    setRenderProgress(0);

    try {
      const pdfjs = await loadPdfjs();
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      const items: PageItem[] = [];

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        // Miniatura ligera: escalamos a ~220px de ancho.
        const base = page.getViewport({ scale: 1 });
        const scale = Math.min(1.5, 220 / base.width);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport }).promise;

        items.push({
          pageNumber: pageNum,
          thumbnail: canvas.toDataURL('image/jpeg', 0.7),
          rotation: 0,
        });
        setRenderProgress(Math.round((pageNum / pdf.numPages) * 100));
        // Cede el hilo para que la barra de progreso respire.
        await new Promise((r) => setTimeout(r, 0));
      }

      setPages(items);
    } catch (error) {
      console.error('Error loading PDF:', error);
      toast.error('No se pudo cargar el PDF', {
        description: 'Asegúrate de que sea un archivo válido.',
      });
      setSelectedFile(null);
    } finally {
      setIsRendering(false);
    }
  };

  const rotatePage = (pageNumber: number, delta: number) => {
    setPages((prev) =>
      prev.map((p) =>
        p.pageNumber === pageNumber ? { ...p, rotation: norm(p.rotation + delta) } : p
      )
    );
  };

  const rotateAll = (delta: number) => {
    setPages((prev) => prev.map((p) => ({ ...p, rotation: norm(p.rotation + delta) })));
  };

  const resetRotations = () => {
    setPages((prev) => prev.map((p) => ({ ...p, rotation: 0 })));
  };

  const anyRotated = pages.some((p) => p.rotation !== 0);

  const applyRotation = async () => {
    if (!selectedFile || !anyRotated) return;
    setIsProcessing(true);
    try {
      const { PDFDocument, degrees } = await import('pdf-lib');
      const arrayBuffer = await selectedFile.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const docPages = pdfDoc.getPages();

      pages.forEach((item, i) => {
        const page = docPages[i];
        if (!page) return;
        const current = page.getRotation().angle;
        page.setRotation(degrees(norm(current + item.rotation)));
      });

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      setDownloadUrl(URL.createObjectURL(blob));
      toast.success('¡PDF girado correctamente!');
    } catch (error) {
      console.error('Error rotating PDF:', error);
      toast.error('No se pudo girar el PDF', {
        description: 'Inténtalo de nuevo.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadRotated = () => {
    if (!downloadUrl) return;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `${baseName()}_girado.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const resetAll = () => {
    setSelectedFile(null);
    setPages([]);
    setDownloadUrl(null);
    setRenderProgress(0);
  };

  const changeFileWithUndo = () => {
    if (!selectedFile) return;
    const snap = { selectedFile, pages, downloadUrl };
    setSelectedFile(null);
    setPages([]);
    setDownloadUrl(null);
    toastUndo('Archivo descartado', {
      description: 'Selecciona otro PDF, o recupéralo si fue un error.',
      onUndo: () => {
        setSelectedFile(snap.selectedFile);
        setPages(snap.pages);
        setDownloadUrl(snap.downloadUrl);
      },
    });
  };

  const step: 1 | 2 | 3 = !selectedFile ? 1 : downloadUrl ? 3 : 2;

  return (
    <ToolShell tool={tool} step={step}>
      {!selectedFile && (
        <>
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
        </>
      )}

      {selectedFile && isRendering && (
        <Card className="mb-8">
          <CardContent className="p-4 sm:p-6">
            <div className="mx-auto max-w-md space-y-3 py-8 text-center" aria-live="polite">
              <Loader2 className={cn('mx-auto h-8 w-8 animate-spin', accent.text)} />
              <p className="font-bold text-ink">Generando vista previa…</p>
              <Progress value={renderProgress} className="h-2" />
              <p className="text-sm text-muted-foreground">{renderProgress}%</p>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedFile && !isRendering && pages.length > 0 && !downloadUrl && (
        <Card className="mb-8 motion-safe:animate-slide-up" ref={editorRef}>
          <CardContent className="p-4 sm:p-6">
            {/* Encabezado + cambiar archivo: apilado en móvil. */}
            <div className="mb-5 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              {/* w-full + min-w-0 (sm:flex-1) para que `truncate` tenga un ancho
                  que respetar; sin esto el nombre largo desbordaba la tarjeta. */}
              <div className="flex w-full min-w-0 items-center gap-3 sm:flex-1">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded border-2 border-ink bg-card">
                  <FileText className="h-5 w-5 text-ink" />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-bold text-ink">{selectedFile.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatFileSize(selectedFile.size)} • {pages.length} página
                    {pages.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={changeFileWithUndo}
                className="shrink-0"
                disabled={isProcessing}
              >
                <X className="mr-2 h-4 w-4" />
                Cambiar archivo
              </Button>
            </div>

            {/* Controles globales: control SEGMENTADO simétrico (divisor navy al
                centro) en vez de botones sueltos; reset como acción sutil. */}
            <div className="mb-6 rounded-lg border-3 border-ink bg-surface p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm font-bold text-ink">
                  Girar todas las páginas
                </span>
                <div className="flex items-center gap-3">
                  <div className="flex flex-1 overflow-hidden rounded-lg border-3 border-ink sm:flex-none">
                    <button
                      type="button"
                      onClick={() => rotateAll(-90)}
                      disabled={isProcessing}
                      className="flex flex-1 items-center justify-center gap-2 border-r-3 border-ink px-4 py-2 text-sm font-bold text-ink transition-colors duration-150 ease-out hover:bg-muted active:bg-muted disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink sm:flex-none"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Izquierda
                    </button>
                    <button
                      type="button"
                      onClick={() => rotateAll(90)}
                      disabled={isProcessing}
                      className="flex flex-1 items-center justify-center gap-2 px-4 py-2 text-sm font-bold text-ink transition-colors duration-150 ease-out hover:bg-muted active:bg-muted disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink sm:flex-none"
                    >
                      <RotateCw className="h-4 w-4" />
                      Derecha
                    </button>
                  </div>
                  {/* Siempre ocupa su lugar (invisible cuando no hay rotación)
                      para que el control segmentado NO se reposicione al
                      aparecer/desaparecer. */}
                  <button
                    type="button"
                    onClick={resetRotations}
                    disabled={isProcessing || !anyRotated}
                    aria-hidden={!anyRotated}
                    tabIndex={anyRotated ? 0 : -1}
                    className={cn(
                      'shrink-0 text-sm font-bold underline-offset-4 transition-colors hover:text-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2',
                      anyRotated
                        ? 'text-muted-foreground'
                        : 'invisible pointer-events-none'
                    )}
                  >
                    Restablecer
                  </button>
                </div>
              </div>
            </div>

            {/* Rejilla de páginas: 2 cols móvil → 4 escritorio. Cada miniatura es
                la superficie de edición; girar con el botón rota la vista. */}
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
              {pages.map((p) => (
                <li
                  key={p.pageNumber}
                  className="flex flex-col overflow-hidden rounded-lg border-3 border-ink bg-surface"
                >
                  <div className="flex aspect-square items-center justify-center overflow-hidden border-b-3 border-ink bg-card p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {/* La hoja rota EN pantalla (no entra/sale) → ease-in-out,
                        300ms (regla de Emil: movimiento on-screen). Sin sombra
                        (invariante del sistema). reduced-motion lo neutraliza el
                        catch-all global. */}
                    <img
                      src={p.thumbnail}
                      alt={`Página ${p.pageNumber}`}
                      className="max-h-full max-w-full object-contain transition-transform duration-300 ease-in-out"
                      style={{ transform: `rotate(${p.rotation}deg)` }}
                      loading="lazy"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2 p-2">
                    <span className="text-xs font-bold text-ink">
                      Pág. {p.pageNumber}
                    </span>
                    {/* Par segmentado simétrico (divisor navy al centro), mismo
                        lenguaje que los controles globales pero a menor escala. */}
                    <div className="flex shrink-0 overflow-hidden rounded-md border-2 border-ink">
                      <button
                        type="button"
                        onClick={() => rotatePage(p.pageNumber, -90)}
                        disabled={isProcessing}
                        aria-label={`Girar página ${p.pageNumber} a la izquierda`}
                        className="flex h-7 w-8 items-center justify-center border-r-2 border-ink text-ink transition-colors duration-150 ease-out hover:bg-muted active:bg-muted disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => rotatePage(p.pageNumber, 90)}
                        disabled={isProcessing}
                        aria-label={`Girar página ${p.pageNumber} a la derecha`}
                        className="flex h-7 w-8 items-center justify-center text-ink transition-colors duration-150 ease-out hover:bg-muted active:bg-muted disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink"
                      >
                        <RotateCw className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-6 text-center">
              <Button
                onClick={applyRotation}
                disabled={isProcessing || !anyRotated}
                aria-busy={isProcessing}
                size="lg"
                className={accent.solid}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Girando…
                  </>
                ) : (
                  <>
                    <RotateCw className="mr-2 h-5 w-5" />
                    Guardar PDF girado
                  </>
                )}
              </Button>
              {/* Ayuda breve fuera del botón (antes el texto largo desbordaba). */}
              {!anyRotated && !isProcessing && (
                <p className="mt-3 text-sm text-muted-foreground">
                  Gira al menos una página para guardar.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {downloadUrl && (
        <Card ref={resultRef} className="motion-safe:animate-slide-up">
          <CardContent className="p-4 text-center sm:p-6">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full border-3 border-ink bg-success text-white">
              <Download className="h-8 w-8" />
            </div>
            <h2 className="mb-2 text-lg font-bold text-success">¡Listo!</h2>
            <p className="mb-6 text-ink">
              Tu PDF girado está listo para descargar como &quot;{baseName()}_girado.pdf&quot;.
            </p>
            <div className="flex flex-col justify-center gap-3 sm:flex-row">
              <Button onClick={downloadRotated} size="lg" className={accent.solid}>
                <Download className="mr-2 h-5 w-5" />
                Descargar PDF
              </Button>
              <Button variant="outline" onClick={resetAll} size="lg">
                Girar otro PDF
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </ToolShell>
  );
}
