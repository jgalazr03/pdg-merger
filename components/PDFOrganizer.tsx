'use client';

import { useState, useRef, useEffect } from 'react';
import type { PDFDocument as PDFDocType, PDFImage, PDFPage } from 'pdf-lib';
import {
  FileText,
  Download,
  Loader2,
  X,
  Plus,
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
import { useFlip } from '@/components/tools/useFlip';

const tool = getTool('organizar');
const accent = tool.accent;

// PDF + imágenes que el navegador sabe decodificar (mismo criterio que Convertir).
const ACCEPT =
  '.pdf,.jpg,.jpeg,.png,.webp,.gif,.bmp,.svg,.avif,application/pdf,image/*';

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

type SourceKind = 'pdf' | 'image';

interface SourceDoc {
  id: string;
  file: File;
  kind: SourceKind;
}

interface PageItem {
  id: string; // clave estable para DnD/animación (no cambia al reordenar)
  srcId: string; // archivo de origen (para copyPages / embed)
  kind: SourceKind;
  sourceIndex: number; // índice 0-based en el PDF original (0 en imágenes)
  pageNumber: number; // número 1-based original (etiqueta)
  label: string; // "nombre · pág. N" (PDF) o "nombre" (imagen)
  thumbnail: string; // data URL
  rotation: number; // delta a aplicar: 0 | 90 | 180 | 270
}

const norm = (deg: number) => ((deg % 360) + 360) % 360;

const isPdf = (file: File) =>
  file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
const stripExt = (name: string) => name.replace(/\.[^./\\]+$/, '');

/** Carga la imagen en un <img> decodificado; rechaza si el navegador no puede. */
function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo decodificar la imagen'));
    };
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('No se pudo exportar la imagen'))),
      mime,
      quality
    );
  });
}

/**
 * Embebe una imagen en el PDF de salida. JPG y PNG van con sus bytes
 * originales (sin recomprimir); el resto (WebP, GIF, BMP, SVG, AVIF…) se
 * rasteriza a PNG vía canvas.
 */
async function embedImage(doc: PDFDocType, file: File): Promise<PDFImage> {
  try {
    if (file.type === 'image/jpeg' || /\.jpe?g$/i.test(file.name)) {
      return await doc.embedJpg(new Uint8Array(await file.arrayBuffer()));
    }
    if (file.type === 'image/png' || /\.png$/i.test(file.name)) {
      return await doc.embedPng(new Uint8Array(await file.arrayBuffer()));
    }
  } catch {
    // pdf-lib no pudo leer los bytes originales: cae a la rasterización.
  }
  const img = await loadImageElement(file);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width || 800;
  canvas.height = img.naturalHeight || img.height || 600;
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(img.src);
  const blob = await canvasToBlob(canvas, 'image/png', 1);
  return doc.embedPng(new Uint8Array(await blob.arrayBuffer()));
}

export default function PDFOrganizer() {
  const [sources, setSources] = useState<SourceDoc[]>([]);
  const [pages, setPages] = useState<PageItem[]>([]);
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  // Estado de arrastre (solo escritorio; en táctil se usan los botones de mover).
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  // Foto del documento "como se cargó" para "Restablecer"; crece al agregar archivos.
  const initialRef = useRef<PageItem[]>([]);
  const addInputRef = useRef<HTMLInputElement>(null);
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
    sources.length > 0 ? stripExt(sources[0].file.name) : 'documento';

  const totalSize = sources.reduce((sum, s) => sum + s.file.size, 0);

  // Con un solo PDF basta "Pág. N"; con varios archivos, el nombre desambigua.
  const cardLabel = (p: PageItem) =>
    sources.length === 1 && p.kind === 'pdf' ? `Pág. ${p.pageNumber}` : p.label;

  /**
   * Agrega archivos (PDF o imágenes) a la rejilla: cada PDF aporta sus páginas
   * y cada imagen, una página. Los que no se puedan abrir se descartan con aviso.
   */
  const addFiles = async (list: FileList | File[]) => {
    const incoming = Array.from(list);
    if (incoming.length === 0) return;
    const firstLoad = pages.length === 0;
    setIsRendering(true);
    setRenderProgress(0);

    const newSources: SourceDoc[] = [];
    const newPages: PageItem[] = [];
    let rejected = 0;

    try {
      for (let f = 0; f < incoming.length; f++) {
        const file = incoming[f];
        const srcId = Math.random().toString(36).substring(2, 11);

        if (isPdf(file)) {
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
                id: `${srcId}-${pageNum - 1}`,
                srcId,
                kind: 'pdf',
                sourceIndex: pageNum - 1,
                pageNumber: pageNum,
                label: `${stripExt(file.name)} · pág. ${pageNum}`,
                thumbnail: canvas.toDataURL('image/jpeg', 0.7),
                rotation: 0,
              });
              setRenderProgress(
                Math.round(((f + pageNum / pdf.numPages) / incoming.length) * 100)
              );
              // Cede el hilo para que la barra de progreso respire.
              await new Promise((r) => setTimeout(r, 0));
            }

            newSources.push({ id: srcId, file, kind: 'pdf' });
            newPages.push(...items);
          } catch (error) {
            console.error('Error loading PDF:', error);
            rejected += 1;
          }
        } else {
          try {
            const img = await loadImageElement(file);
            const w = img.naturalWidth || img.width || 800;
            const h = img.naturalHeight || img.height || 600;
            const scale = Math.min(1.5, 220 / w);
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d')!;
            canvas.width = Math.max(1, Math.round(w * scale));
            canvas.height = Math.max(1, Math.round(h * scale));
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(img.src);

            newSources.push({ id: srcId, file, kind: 'image' });
            newPages.push({
              id: `${srcId}-0`,
              srcId,
              kind: 'image',
              sourceIndex: 0,
              pageNumber: 1,
              label: stripExt(file.name),
              thumbnail: canvas.toDataURL('image/jpeg', 0.7),
              rotation: 0,
            });
          } catch {
            rejected += 1;
          }
          setRenderProgress(Math.round(((f + 1) / incoming.length) * 100));
        }
      }
    } finally {
      setIsRendering(false);
    }

    if (newPages.length > 0) {
      setSources((prev) => [...prev, ...newSources]);
      setPages((prev) => [...prev, ...newPages]);
      // "Restablecer" vuelve al orden de carga, conservando los archivos agregados.
      initialRef.current = [...initialRef.current, ...newPages.map((p) => ({ ...p }))];
      setDownloadUrl(null);
      if (!firstLoad) {
        toast.success(
          `${newPages.length} página${newPages.length !== 1 ? 's' : ''} agregada${
            newPages.length !== 1 ? 's' : ''
          }`
        );
      }
    }
    if (rejected > 0) {
      toast.error(
        `${rejected} archivo${rejected !== 1 ? 's' : ''} no se ${
          rejected !== 1 ? 'pudieron' : 'pudo'
        } abrir`,
        {
          description:
            'Solo PDF e imágenes que el navegador pueda abrir (JPG, PNG, WebP, GIF, BMP, SVG, AVIF).',
        }
      );
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
        description: `Quitaste «${cardLabel(removed)}».`,
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

  // FLIP: desliza las miniaturas a su nueva celda al reordenar (arrastre o flechas).
  const gridRef = useFlip<HTMLUListElement>(pages.map((p) => p.id).join('|'));

  // ¿Hay cambios respecto a los documentos cargados? (orden, giros o eliminaciones)
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
    if (pages.length === 0) return;
    setIsProcessing(true);
    try {
      const { PDFDocument, degrees } = await import('pdf-lib');
      const out = await PDFDocument.create();

      // 1) Copia (sin pérdida) las páginas de cada PDF de origen — cargándolo
      //    una sola vez — y guárdalas por id para ensamblarlas después.
      const copiedById = new Map<string, PDFPage>();
      for (const src of sources) {
        if (src.kind !== 'pdf') continue;
        const items = pages.filter((p) => p.srcId === src.id);
        if (items.length === 0) continue;
        const doc = await PDFDocument.load(await src.file.arrayBuffer());
        const copied = await out.copyPages(
          doc,
          items.map((p) => p.sourceIndex)
        );
        copied.forEach((page, i) => copiedById.set(items[i].id, page));
      }

      const srcById = new Map(sources.map((s) => [s.id, s]));

      // 2) Ensambla el documento en el orden de la rejilla y aplica los giros.
      for (const p of pages) {
        if (p.kind === 'pdf') {
          const page = copiedById.get(p.id);
          if (!page) continue;
          const current = page.getRotation().angle;
          page.setRotation(degrees(norm(current + p.rotation)));
          out.addPage(page);
        } else {
          const src = srcById.get(p.srcId);
          if (!src) continue;
          const embedded = await embedImage(out, src.file);
          const page = out.addPage([embedded.width, embedded.height]);
          page.drawImage(embedded, {
            x: 0,
            y: 0,
            width: embedded.width,
            height: embedded.height,
          });
          if (p.rotation !== 0) page.setRotation(degrees(norm(p.rotation)));
        }
      }

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
    setSources([]);
    setPages([]);
    setDownloadUrl(null);
    setRenderProgress(0);
    initialRef.current = [];
  };

  const clearAllWithUndo = () => {
    if (sources.length === 0) return;
    const snap = { sources, pages, initial: initialRef.current };
    setSources([]);
    setPages([]);
    setDownloadUrl(null);
    initialRef.current = [];
    toastUndo('Archivos descartados', {
      description: 'Agrega otros archivos, o recupéralos si fue un error.',
      onUndo: () => {
        initialRef.current = snap.initial;
        setSources(snap.sources);
        setPages(snap.pages);
      },
    });
  };

  const step: 1 | 2 | 3 =
    sources.length === 0 && !isRendering ? 1 : downloadUrl ? 3 : 2;

  return (
    <ToolShell tool={tool} step={step}>
      {/* Entrada oculta para "Agregar" desde el editor; value se limpia para
          permitir volver a elegir el mismo archivo. */}
      <input
        ref={addInputRef}
        type="file"
        multiple
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) addFiles(e.target.files);
          e.target.value = '';
        }}
      />

      {sources.length === 0 && !isRendering && (
        <>
          <FileDropzone
            className="mb-4"
            accent={accent}
            loaded={step > 1}
            accept={ACCEPT}
            multiple
            idleTitle="Selecciona PDF o imágenes"
            idleSubtitle="Haz clic aquí o arrastra y suelta uno o varios archivos: PDF, JPG, PNG, WebP, GIF, BMP, SVG o AVIF."
            dragTitle="Suelta los archivos aquí"
            buttonLabel="Seleccionar archivos"
            ariaLabel="Seleccionar o arrastrar archivos PDF o imágenes"
            onFiles={(files) => addFiles(files)}
          />
          <ToolConstraints items={tool.constraints} />
        </>
      )}

      {isRendering && pages.length === 0 && (
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

      {pages.length > 0 && !downloadUrl && (
        <Card className="mb-8 motion-safe:animate-slide-up" ref={editorRef}>
          <CardContent className="p-4 sm:p-6">
            {/* Encabezado + agregar/quitar: apilado en móvil. */}
            <div className="mb-5 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex w-full min-w-0 items-center gap-3 sm:flex-1">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded border-2 border-ink bg-card">
                  <FileText className="h-5 w-5 text-ink" />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-bold text-ink">
                    {sources.length === 1
                      ? sources[0].file.name
                      : `${sources.length} archivos`}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatFileSize(totalSize)} • {pages.length} página
                    {pages.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <div className="flex w-full shrink-0 gap-2 sm:w-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addInputRef.current?.click()}
                  className="flex-1 sm:flex-none"
                  disabled={isProcessing || isRendering}
                >
                  {isRendering ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" />
                  )}
                  Agregar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearAllWithUndo}
                  className="flex-1 sm:flex-none"
                  disabled={isProcessing || isRendering}
                >
                  <X className="mr-2 h-4 w-4" />
                  Quitar todo
                </Button>
              </div>
            </div>

            {/* Pista de la única afordancia no obvia (arrastrar) + Restablecer
                en la misma línea: el botón reserva su lugar siempre (invisible
                si no hay cambios), sin layout shift. */}
            <div className="mb-4 flex min-h-[32px] items-center justify-between gap-3">
              <p className="min-w-0 text-xs text-muted-foreground">
                Arrastra una página para reordenarla, o usa los botones de mover.
              </p>
              <button
                type="button"
                onClick={resetChanges}
                disabled={isProcessing || !dirty}
                aria-hidden={!dirty}
                tabIndex={dirty ? 0 : -1}
                aria-label="Restablecer cambios"
                title="Restablecer cambios"
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 ease-out hover-fine:bg-muted hover-fine:text-ink active:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2',
                  dirty ? '' : 'invisible pointer-events-none'
                )}
              >
                <Undo2 className="h-4 w-4" />
              </button>
            </div>

            {/* Rejilla de páginas: 2 cols móvil → 4 escritorio. Cada tarjeta es
                arrastrable (escritorio); los botones cubren táctil y teclado. */}
            <ul ref={gridRef} className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
              {pages.map((p, i) => (
                <li
                  key={p.id}
                  data-flip-id={p.id}
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
                    'group relative flex flex-col overflow-hidden rounded-lg border-3 border-ink bg-surface transition-[opacity,box-shadow] duration-150 ease-out sm:cursor-grab sm:active:cursor-grabbing',
                    dragIndex === i && 'opacity-50',
                    overIndex === i && dragIndex !== null && dragIndex !== i &&
                      'ring-2 ring-ink ring-offset-2'
                  )}
                >
                  {/* Insignia de posición en el nuevo orden. */}
                  <span className="pointer-events-none absolute left-2 top-2 z-10 inline-flex h-6 min-w-[24px] items-center justify-center rounded-md border-2 border-ink bg-surface px-1.5 text-xs font-bold text-ink">
                    {i + 1}
                  </span>

                  {/* Girar = acción poco frecuente → fuera del flujo principal
                      (progressive disclosure): overlay discreto en la esquina de
                      la miniatura, invisible en escritorio hasta hover o foco de
                      teclado (solo opacidad, 150ms ease-out). En táctil no hay
                      hover, así que queda siempre visible. Registro "callado"
                      (Vercel): chico, borde fino de 1px e icono apagado que solo
                      toma tinta al interactuar, sin competir con la insignia de
                      posición ni el contenido. */}
                  <div
                    className={cn(
                      'absolute right-2 top-2 z-10 flex overflow-hidden rounded-md border border-ink bg-surface',
                      'transition-opacity duration-150 ease-out pointer-fine:opacity-0 group-hover-fine:opacity-100 focus-within:opacity-100'
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => rotatePage(p.id, -90)}
                      disabled={isProcessing}
                      aria-label={`Girar ${cardLabel(p)} a la izquierda`}
                      title="Girar a la izquierda"
                      className="flex h-6 w-6 items-center justify-center border-r border-ink text-muted-foreground transition-colors duration-150 ease-out hover-fine:bg-muted hover-fine:text-ink active:bg-muted disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink"
                    >
                      <RotateCcw className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => rotatePage(p.id, 90)}
                      disabled={isProcessing}
                      aria-label={`Girar ${cardLabel(p)} a la derecha`}
                      title="Girar a la derecha"
                      className="flex h-6 w-6 items-center justify-center text-muted-foreground transition-colors duration-150 ease-out hover-fine:bg-muted hover-fine:text-ink active:bg-muted disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink"
                    >
                      <RotateCw className="h-3 w-3" />
                    </button>
                  </div>

                  <div className="flex aspect-square items-center justify-center overflow-hidden border-b-3 border-ink bg-card p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {/* La hoja rota EN pantalla → ease-in-out 300ms (regla de Emil).
                        draggable=false en la imagen para que arrastre la tarjeta,
                        no la imagen. reduced-motion lo neutraliza el catch-all global. */}
                    <img
                      src={p.thumbnail}
                      alt={cardLabel(p)}
                      draggable={false}
                      className="max-h-full max-w-full object-contain transition-transform duration-300 ease-in-out"
                      style={{ transform: `rotate(${p.rotation}deg)` }}
                      loading="lazy"
                    />
                  </div>

                  {/* Pie de acciones frecuentes: mover (◀ ▶) y eliminar; girar
                      vive en el overlay de la miniatura. Cada grupo en su propia
                      fila a ancho completo (grid 2 cols → minmax(0,1fr), nunca
                      recorta en tarjetas angostas). */}
                  <div className="flex flex-col gap-2 p-2">
                    <span className="truncate text-xs font-bold text-ink" title={p.label}>
                      {cardLabel(p)}
                    </span>

                    <div className="grid grid-cols-2 overflow-hidden rounded-md border-2 border-ink">
                      <button
                        type="button"
                        onClick={() => movePage(i, i - 1)}
                        disabled={isProcessing || i === 0}
                        aria-label={`Mover ${cardLabel(p)} hacia atrás`}
                        title="Mover hacia atrás"
                        className="flex h-9 items-center justify-center border-r-2 border-ink text-ink transition-colors duration-150 ease-out hover-fine:bg-muted active:bg-muted disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => movePage(i, i + 1)}
                        disabled={isProcessing || i === pages.length - 1}
                        aria-label={`Mover ${cardLabel(p)} hacia adelante`}
                        title="Mover hacia adelante"
                        className="flex h-9 items-center justify-center text-ink transition-colors duration-150 ease-out hover-fine:bg-muted active:bg-muted disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Eliminar = destructivo → rojo de marca (invariante del sistema). */}
                    <button
                      type="button"
                      onClick={() => deletePage(p.id)}
                      disabled={isProcessing || pages.length <= 1}
                      aria-label={`Eliminar ${cardLabel(p)}`}
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
                disabled={isProcessing || isRendering}
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
                Organizar otros archivos
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </ToolShell>
  );
}
