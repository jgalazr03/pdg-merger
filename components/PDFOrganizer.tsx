'use client';

import { useState, useRef, useEffect } from 'react';
import {
  FileText,
  Download,
  Loader2,
  X,
  RotateCw,
  RotateCcw,
  Undo2,
  ChevronLeft,
  ChevronRight,
  Trash2,
  LayoutGrid,
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

const tool = getTool('organizar');
const accent = tool.accent;

// Carga perezosa y memoizada de pdfjs-dist (solo para las miniaturas); configura
// el worker una sola vez. pdf-lib (la reorganización real, sin pérdida) se
// importa aparte al guardar. Así la herramienta abre al instante.
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
  id: string; // clave estable para DnD/animación (no cambia al reordenar)
  sourceIndex: number; // índice 0-based en el PDF original (para copyPages)
  pageNumber: number; // número 1-based original (etiqueta)
  thumbnail: string; // data URL
  rotation: number; // delta a aplicar: 0 | 90 | 180 | 270
}

const norm = (deg: number) => ((deg % 360) + 360) % 360;

export default function PDFOrganizer() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pages, setPages] = useState<PageItem[]>([]);
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  // Estado de arrastre (solo escritorio; en táctil se usan los botones de mover).
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  // Foto del documento recién cargado para "Restablecer".
  const initialRef = useRef<PageItem[]>([]);
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
          id: `p-${pageNum - 1}`,
          sourceIndex: pageNum - 1,
          pageNumber: pageNum,
          thumbnail: canvas.toDataURL('image/jpeg', 0.7),
          rotation: 0,
        });
        setRenderProgress(Math.round((pageNum / pdf.numPages) * 100));
        // Cede el hilo para que la barra de progreso respire.
        await new Promise((r) => setTimeout(r, 0));
      }

      initialRef.current = items.map((p) => ({ ...p }));
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

  const movePage = (from: number, to: number) => {
    setPages((prev) => {
      if (to < 0 || to >= prev.length || from === to) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const rotatePage = (id: string, delta: number) => {
    setPages((prev) =>
      prev.map((p) => (p.id === id ? { ...p, rotation: norm(p.rotation + delta) } : p))
    );
  };

  const deletePage = (id: string) => {
    setPages((prev) => {
      if (prev.length <= 1) {
        toast.error('No puedes eliminar la última página', {
          description: 'Un PDF debe tener al menos una página.',
        });
        return prev;
      }
      const idx = prev.findIndex((p) => p.id === id);
      if (idx < 0) return prev;
      const removed = prev[idx];
      const next = prev.filter((p) => p.id !== id);
      toastUndo('Página eliminada', {
        description: `Quitaste la página ${removed.pageNumber}.`,
        onUndo: () =>
          setPages((cur) => {
            const restored = [...cur];
            restored.splice(Math.min(idx, restored.length), 0, removed);
            return restored;
          }),
      });
      return next;
    });
  };

  const resetChanges = () => {
    setPages(initialRef.current.map((p) => ({ ...p, rotation: 0 })));
  };

  // ¿Hay cambios respecto al documento original? (orden, giros o eliminaciones)
  const dirty =
    pages.length !== initialRef.current.length ||
    pages.some((p, i) => {
      const init = initialRef.current[i];
      return !init || init.id !== p.id || p.rotation !== 0;
    });

  // --- Arrastrar y soltar (escritorio) ---
  const handleDrop = (dropIndex: number) => {
    if (dragIndex !== null) movePage(dragIndex, dropIndex);
    setDragIndex(null);
    setOverIndex(null);
  };

  const applyOrganize = async () => {
    if (!selectedFile || pages.length === 0) return;
    setIsProcessing(true);
    try {
      const { PDFDocument, degrees } = await import('pdf-lib');
      const arrayBuffer = await selectedFile.arrayBuffer();
      const src = await PDFDocument.load(arrayBuffer);
      const out = await PDFDocument.create();

      // Copia (sin pérdida) las páginas en el nuevo orden y aplica los giros.
      const copied = await out.copyPages(
        src,
        pages.map((p) => p.sourceIndex)
      );
      copied.forEach((page, i) => {
        const current = page.getRotation().angle;
        page.setRotation(degrees(norm(current + pages[i].rotation)));
        out.addPage(page);
      });

      const pdfBytes = await out.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      setDownloadUrl(URL.createObjectURL(blob));
      toast.success('¡PDF organizado correctamente!');
    } catch (error) {
      console.error('Error organizing PDF:', error);
      toast.error('No se pudo organizar el PDF', {
        description: 'Inténtalo de nuevo.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadOrganized = () => {
    if (!downloadUrl) return;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `${baseName()}_organizado.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const resetAll = () => {
    setSelectedFile(null);
    setPages([]);
    setDownloadUrl(null);
    setRenderProgress(0);
    initialRef.current = [];
  };

  const changeFileWithUndo = () => {
    if (!selectedFile) return;
    const snap = { selectedFile, pages, downloadUrl, initial: initialRef.current };
    setSelectedFile(null);
    setPages([]);
    setDownloadUrl(null);
    toastUndo('Archivo descartado', {
      description: 'Selecciona otro PDF, o recupéralo si fue un error.',
      onUndo: () => {
        initialRef.current = snap.initial;
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

            {/* Barra de control: rótulo a la izquierda + Restablecer (ícono) a la
                derecha. Restablecer reserva su lugar siempre (invisible si no hay
                cambios): sin layout shift. Un solo botón sirve en ambos breakpoints. */}
            <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border-3 border-ink bg-surface p-3">
              <span className="min-w-0 truncate text-sm font-bold text-ink">
                Organiza tus páginas
              </span>
              <button
                type="button"
                onClick={resetChanges}
                disabled={isProcessing || !dirty}
                aria-hidden={!dirty}
                tabIndex={dirty ? 0 : -1}
                aria-label="Restablecer cambios"
                title="Restablecer cambios"
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 ease-out hover-fine:bg-muted hover-fine:text-ink active:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2',
                  dirty ? '' : 'invisible pointer-events-none'
                )}
              >
                <Undo2 className="h-4 w-4" />
              </button>
            </div>

            {/* Pista de la única afordancia no obvia (arrastrar); el resto se ve. */}
            <p className="mb-4 text-xs text-muted-foreground">
              Arrastra una página para reordenarla, o usa los botones de mover.
            </p>

            {/* Rejilla de páginas: 2 cols móvil → 4 escritorio. Cada tarjeta es
                arrastrable (escritorio); los botones cubren táctil y teclado. */}
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
              {pages.map((p, i) => (
                <li
                  key={p.id}
                  draggable={!isProcessing}
                  onDragStart={() => setDragIndex(i)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (overIndex !== i) setOverIndex(i);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleDrop(i);
                  }}
                  onDragEnd={() => {
                    setDragIndex(null);
                    setOverIndex(null);
                  }}
                  className={cn(
                    'relative flex flex-col overflow-hidden rounded-lg border-3 border-ink bg-surface transition-[opacity,box-shadow] duration-150 ease-out sm:cursor-grab sm:active:cursor-grabbing',
                    dragIndex === i && 'opacity-50',
                    overIndex === i && dragIndex !== null && dragIndex !== i &&
                      'ring-2 ring-ink ring-offset-2'
                  )}
                >
                  {/* Insignia de posición en el nuevo orden. */}
                  <span className="pointer-events-none absolute left-2 top-2 z-10 inline-flex h-6 min-w-[24px] items-center justify-center rounded-md border-2 border-ink bg-surface px-1.5 text-xs font-bold text-ink">
                    {i + 1}
                  </span>

                  <div className="flex aspect-square items-center justify-center overflow-hidden border-b-3 border-ink bg-card p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {/* La hoja rota EN pantalla → ease-in-out 300ms (regla de Emil).
                        draggable=false en la imagen para que arrastre la tarjeta,
                        no la imagen. reduced-motion lo neutraliza el catch-all global. */}
                    <img
                      src={p.thumbnail}
                      alt={`Página ${p.pageNumber}`}
                      draggable={false}
                      className="max-h-full max-w-full object-contain transition-transform duration-300 ease-in-out"
                      style={{ transform: `rotate(${p.rotation}deg)` }}
                      loading="lazy"
                    />
                  </div>

                  {/* Pie de acciones: mover (◀ ▶), girar (↺ ↻) y eliminar, cada
                      grupo en su propia fila a ancho completo (grid 2 cols →
                      minmax(0,1fr), nunca recorta en tarjetas angostas). */}
                  <div className="flex flex-col gap-2 p-2">
                    <span className="text-xs font-bold text-ink">Pág. {p.pageNumber}</span>

                    <div className="grid grid-cols-2 overflow-hidden rounded-md border-2 border-ink">
                      <button
                        type="button"
                        onClick={() => movePage(i, i - 1)}
                        disabled={isProcessing || i === 0}
                        aria-label={`Mover página ${p.pageNumber} hacia atrás`}
                        title="Mover hacia atrás"
                        className="flex h-9 items-center justify-center border-r-2 border-ink text-ink transition-colors duration-150 ease-out hover-fine:bg-muted active:bg-muted disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => movePage(i, i + 1)}
                        disabled={isProcessing || i === pages.length - 1}
                        aria-label={`Mover página ${p.pageNumber} hacia adelante`}
                        title="Mover hacia adelante"
                        className="flex h-9 items-center justify-center text-ink transition-colors duration-150 ease-out hover-fine:bg-muted active:bg-muted disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 overflow-hidden rounded-md border-2 border-ink">
                      <button
                        type="button"
                        onClick={() => rotatePage(p.id, -90)}
                        disabled={isProcessing}
                        aria-label={`Girar página ${p.pageNumber} a la izquierda`}
                        title="Girar a la izquierda"
                        className="flex h-9 items-center justify-center border-r-2 border-ink text-ink transition-colors duration-150 ease-out hover-fine:bg-muted active:bg-muted disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => rotatePage(p.id, 90)}
                        disabled={isProcessing}
                        aria-label={`Girar página ${p.pageNumber} a la derecha`}
                        title="Girar a la derecha"
                        className="flex h-9 items-center justify-center text-ink transition-colors duration-150 ease-out hover-fine:bg-muted active:bg-muted disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink"
                      >
                        <RotateCw className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Eliminar = destructivo → rojo de marca (invariante del sistema). */}
                    <button
                      type="button"
                      onClick={() => deletePage(p.id)}
                      disabled={isProcessing || pages.length <= 1}
                      aria-label={`Eliminar página ${p.pageNumber}`}
                      title="Eliminar página"
                      className="flex h-9 items-center justify-center gap-1.5 rounded-md border-2 border-ink text-xs font-bold text-brand-red transition-colors duration-150 ease-out hover-fine:bg-brand-red hover-fine:text-white active:bg-brand-red disabled:opacity-30 disabled:hover-fine:bg-transparent disabled:hover-fine:text-brand-red focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink"
                    >
                      <Trash2 className="h-4 w-4" />
                      Eliminar
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-6 text-center">
              <Button
                onClick={applyOrganize}
                disabled={isProcessing}
                aria-busy={isProcessing}
                size="lg"
                className={accent.solid}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Organizando…
                  </>
                ) : (
                  <>
                    <LayoutGrid className="mr-2 h-5 w-5" />
                    Guardar PDF organizado
                  </>
                )}
              </Button>
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
              Tu PDF organizado está listo para descargar como &quot;{baseName()}_organizado.pdf&quot;.
            </p>
            <div className="flex flex-col justify-center gap-3 sm:flex-row">
              <Button onClick={downloadOrganized} size="lg" className={accent.solid}>
                <Download className="mr-2 h-5 w-5" />
                Descargar PDF
              </Button>
              <Button variant="outline" onClick={resetAll} size="lg">
                Organizar otro PDF
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </ToolShell>
  );
}
