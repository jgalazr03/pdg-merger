'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';
import {
  FileText,
  Download,
  Loader2,
  X,
  Repeat,
  ImageIcon,
  Settings2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { cn, scrollIntoViewSafe } from '@/lib/utils';
import { toastUndo } from '@/lib/toast';
import { getTool } from '@/lib/tools';
import ToolShell from '@/components/tools/ToolShell';
import FileDropzone from '@/components/tools/FileDropzone';
import ToolConstraints from '@/components/tools/ToolConstraints';

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
}

const tool = getTool('convertir');
const accent = tool.accent;

/* ------------------------------------------------------------------ *
 * Capacidades reales del NAVEGADOR (no se promete lo que no se puede):
 *  - Entrada decodificable: PDF + imágenes que el navegador sabe pintar.
 *  - Salida: JPG/PNG/WebP (canvas) y PDF (pdf-lib). Office/TIFF/HEIC NO.
 * ------------------------------------------------------------------ */

type ImageTarget = 'jpg' | 'png' | 'webp';
type Target = ImageTarget | 'pdf';
type Kind = 'image' | 'pdf';

const TARGET_META: Record<Target, { label: string; mime: string; ext: string; hint: string }> = {
  jpg: { label: 'JPG', mime: 'image/jpeg', ext: 'jpg', hint: 'Fotos, menor peso' },
  png: { label: 'PNG', mime: 'image/png', ext: 'png', hint: 'Sin pérdida, transparencia' },
  webp: { label: 'WebP', mime: 'image/webp', ext: 'webp', hint: 'Peso mínimo, moderno' },
  pdf: { label: 'PDF', mime: 'application/pdf', ext: 'pdf', hint: 'Un documento por imagen' },
};

// Nivel único que modula resolución (escala de render del PDF) y calidad JPEG/WebP.
type Level = 'normal' | 'alta' | 'maxima';
const LEVELS: Record<Level, { scale: number; quality: number; label: string; description: string }> = {
  normal: { scale: 1, quality: 0.85, label: 'Normal', description: 'Para pantalla' },
  alta: { scale: 1.5, quality: 0.9, label: 'Alta', description: 'Equilibrado' },
  maxima: { scale: 2.5, quality: 0.92, label: 'Máxima', description: 'Para imprimir' },
};

interface SourceFile {
  id: string;
  file: File;
  name: string; // sin extensión
  kind: Kind;
}

interface ResultFile {
  id: string;
  name: string; // con extensión
  blob: Blob;
  kind: Kind;
  previewUrl?: string; // solo para resultados de imagen
}

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|bmp|svg|avif)$/i;
const stripExt = (name: string) => name.replace(/\.[^./\\]+$/, '');

const isPdf = (file: File) =>
  file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
const looksLikeImage = (file: File) =>
  file.type.startsWith('image/') || IMAGE_EXT.test(file.name);

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

export default function FileConverter() {
  const [files, setFiles] = useState<SourceFile[]>([]);
  const [target, setTarget] = useState<Target>('jpg');
  const [level, setLevel] = useState<Level>('alta');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ResultFile[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (files.length > 0 && results.length === 0 && listRef.current) {
      setTimeout(() => scrollIntoViewSafe(listRef.current), 100);
    }
  }, [files.length, results.length]);

  useEffect(() => {
    if (results.length > 0) {
      setTimeout(() => scrollIntoViewSafe(resultRef.current), 100);
    }
  }, [results.length]);

  // Limpia las URLs de preview al desmontar / regenerar resultados.
  useEffect(() => {
    return () => {
      results.forEach((r) => r.previewUrl && URL.revokeObjectURL(r.previewUrl));
    };
  }, [results]);

  const hasPdf = files.some((f) => f.kind === 'pdf');
  const hasImage = files.some((f) => f.kind === 'image');

  // Destinos disponibles según el origen: PDF como destino solo si TODO son
  // imágenes (no hay "PDF a PDF"; para combinar imágenes en uno está Unir).
  const availableTargets = useMemo<Target[]>(() => {
    if (files.length === 0) return ['jpg', 'png', 'webp', 'pdf'];
    const imgTargets: Target[] = ['jpg', 'png', 'webp'];
    return hasImage && !hasPdf ? [...imgTargets, 'pdf'] : imgTargets;
  }, [files.length, hasImage, hasPdf]);

  // Si el destino actual deja de ser válido al cambiar los archivos, reencaja.
  useEffect(() => {
    if (!availableTargets.includes(target)) setTarget(availableTargets[0]);
  }, [availableTargets, target]);

  // El selector de nivel solo aporta cuando influye: a JPG/WebP (calidad) o
  // desde un PDF (resolución de render). A PNG sin PDF de origen es irrelevante.
  const showLevel =
    target === 'jpg' || target === 'webp' || (hasPdf && target !== 'pdf');

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleFileSelect = async (selected: FileList) => {
    const incoming = Array.from(selected);
    const accepted: SourceFile[] = [];
    const rejected: string[] = [];

    for (const file of incoming) {
      if (isPdf(file)) {
        accepted.push({
          id: Math.random().toString(36).substring(2, 11),
          file,
          name: stripExt(file.name),
          kind: 'pdf',
        });
        continue;
      }
      if (looksLikeImage(file)) {
        // Verifica que el navegador realmente pueda decodificarla (descarta
        // HEIC/TIFF y archivos corruptos antes de prometer la conversión).
        try {
          await loadImageElement(file);
          accepted.push({
            id: Math.random().toString(36).substring(2, 11),
            file,
            name: stripExt(file.name),
            kind: 'image',
          });
        } catch {
          rejected.push(file.name);
        }
        continue;
      }
      rejected.push(file.name);
    }

    if (rejected.length > 0) {
      toast.error('Algunos archivos no se pueden convertir', {
        description:
          'Solo PDF e imágenes que el navegador pueda abrir (JPG, PNG, WebP, GIF, BMP, SVG, AVIF).',
      });
    }
    if (accepted.length > 0) {
      setResults([]);
      setFiles((prev) => [...prev, ...accepted]);
      toast.success(
        `${accepted.length} archivo${accepted.length !== 1 ? 's' : ''} agregado${accepted.length !== 1 ? 's' : ''}`
      );
    }
  };

  const removeFile = (id: string) => setFiles((prev) => prev.filter((f) => f.id !== id));

  const clearAll = () => {
    if (files.length === 0) return;
    const snapshot = files;
    const count = files.length;
    setFiles([]);
    setResults([]);
    toastUndo('Lista vaciada', {
      description: `Se ${count === 1 ? 'quitó' : 'quitaron'} ${count} archivo${count !== 1 ? 's' : ''}.`,
      onUndo: () => setFiles(snapshot),
    });
  };

  /** Una imagen de origen → canvas pintado (fondo blanco solo si el destino es JPG). */
  const drawImageToCanvas = (img: HTMLImageElement, opaque: boolean): HTMLCanvasElement => {
    const w = img.naturalWidth || img.width || 800;
    const h = img.naturalHeight || img.height || 600;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    if (opaque) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
    }
    ctx.drawImage(img, 0, 0, w, h);
    return canvas;
  };

  const convertImageToImage = async (src: SourceFile, t: ImageTarget): Promise<ResultFile> => {
    const img = await loadImageElement(src.file);
    const canvas = drawImageToCanvas(img, t === 'jpg');
    URL.revokeObjectURL(img.src);
    const { quality } = LEVELS[level];
    const blob = await canvasToBlob(canvas, TARGET_META[t].mime, quality);
    return {
      id: `${src.id}-${t}`,
      name: `${src.name}.${TARGET_META[t].ext}`,
      blob,
      kind: 'image',
      previewUrl: URL.createObjectURL(blob),
    };
  };

  const convertImageToPdf = async (src: SourceFile): Promise<ResultFile> => {
    const img = await loadImageElement(src.file);
    // Rasterizamos a PNG (conserva transparencia) y lo embebemos en una hoja del
    // tamaño exacto de la imagen, sin márgenes.
    const canvas = drawImageToCanvas(img, false);
    URL.revokeObjectURL(img.src);
    const pngBlob = await canvasToBlob(canvas, 'image/png', 1);
    const pngBytes = new Uint8Array(await pngBlob.arrayBuffer());

    const pdfDoc = await PDFDocument.create();
    const embedded = await pdfDoc.embedPng(pngBytes);
    const page = pdfDoc.addPage([canvas.width, canvas.height]);
    page.drawImage(embedded, { x: 0, y: 0, width: canvas.width, height: canvas.height });
    const pdfBytes = await pdfDoc.save();

    return {
      id: `${src.id}-pdf`,
      name: `${src.name}.pdf`,
      blob: new Blob([pdfBytes], { type: 'application/pdf' }),
      kind: 'pdf',
    };
  };

  const convertPdfToImages = async (src: SourceFile, t: ImageTarget): Promise<ResultFile[]> => {
    const { scale, quality } = LEVELS[level];
    const arrayBuffer = await src.file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const out: ResultFile[] = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;

      const blob = await canvasToBlob(canvas, TARGET_META[t].mime, quality);
      out.push({
        id: `${src.id}-p${pageNum}`,
        name: `${src.name}_pagina_${pageNum}.${TARGET_META[t].ext}`,
        blob,
        kind: 'image',
        previewUrl: URL.createObjectURL(blob),
      });
      // Cede el hilo para que la barra de progreso respire.
      await new Promise((r) => setTimeout(r, 0));
    }
    return out;
  };

  const convert = async () => {
    if (files.length === 0) return;
    setIsProcessing(true);
    setProgress(0);
    const out: ResultFile[] = [];
    let done = 0;

    try {
      for (const src of files) {
        if (src.kind === 'pdf' && target !== 'pdf') {
          out.push(...(await convertPdfToImages(src, target as ImageTarget)));
        } else if (src.kind === 'image' && target === 'pdf') {
          out.push(await convertImageToPdf(src));
        } else if (src.kind === 'image' && target !== 'pdf') {
          out.push(await convertImageToImage(src, target as ImageTarget));
        }
        done += 1;
        setProgress(Math.round((done / files.length) * 100));
        await new Promise((r) => setTimeout(r, 0));
      }

      setResults(out);
      toast.success(
        `Se ${out.length === 1 ? 'generó' : 'generaron'} ${out.length} archivo${out.length !== 1 ? 's' : ''}`
      );
    } catch (error) {
      console.error('Error converting files:', error);
      out.forEach((r) => r.previewUrl && URL.revokeObjectURL(r.previewUrl));
      toast.error('No se pudo completar la conversión', {
        description: 'Revisa los archivos e inténtalo de nuevo.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadResult = (r: ResultFile) => {
    const url = URL.createObjectURL(r.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = r.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadAll = async () => {
    if (results.length === 0) return;
    if (results.length === 1) {
      downloadResult(results[0]);
      return;
    }
    const zip = new JSZip();
    results.forEach((r) => zip.file(r.name, r.blob));
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `convertidos_${TARGET_META[target].ext}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const resetAll = () => {
    setFiles([]);
    setResults([]);
    setProgress(0);
  };

  const step: 1 | 2 | 3 = files.length === 0 ? 1 : results.length > 0 ? 3 : 2;

  return (
    <ToolShell tool={tool} step={step}>
      <FileDropzone
        className="mb-4"
        accent={accent}
        multiple
        accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.bmp,.svg,.avif,application/pdf,image/*"
        idleTitle="Selecciona PDF o imágenes"
        idleSubtitle="Haz clic aquí o arrastra y suelta tus archivos PDF o imágenes"
        dragTitle="Suelta los archivos aquí"
        buttonLabel="Seleccionar archivos"
        ariaLabel="Seleccionar o arrastrar archivos PDF o imágenes"
        onFiles={handleFileSelect}
      />

      <ToolConstraints items={tool.constraints} />

      {files.length > 0 && results.length === 0 && (
        <Card className="mb-8 motion-safe:animate-slide-up" ref={listRef}>
          <CardContent className="p-4 sm:p-6">
            {/* Encabezado + acción: apilados en móvil (el título mono envuelve
                y chocaría con el botón); en una fila a partir de sm. */}
            <div className="mb-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="font-display text-lg font-bold text-ink">
                Archivos seleccionados ({files.length})
              </h2>
              <Button
                variant="outline"
                size="sm"
                onClick={clearAll}
                className="shrink-0"
                disabled={isProcessing}
              >
                <X className="mr-2 h-4 w-4" />
                Limpiar todo
              </Button>
            </div>

            <ul className="space-y-3">
              {files.map((f) => (
                <li
                  key={f.id}
                  className="flex items-center gap-3 rounded-lg border-3 border-ink bg-surface p-3 sm:p-4"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded border-2 border-ink bg-card">
                    {f.kind === 'pdf' ? (
                      <FileText className="h-5 w-5 text-ink" />
                    ) : (
                      <ImageIcon className="h-5 w-5 text-ink" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ink">{f.file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {f.kind === 'pdf' ? 'PDF' : 'Imagen'} • {formatFileSize(f.file.size)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(f.id)}
                    aria-label={`Quitar ${f.file.name}`}
                    className="shrink-0 text-muted-foreground hover:text-ink"
                    disabled={isProcessing}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>

            {/* Destino */}
            <div className="mt-6">
              <Label className="mb-3 block text-sm font-medium text-ink">
                <Repeat className="mr-2 inline h-4 w-4" />
                Convertir a
              </Label>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {availableTargets.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTarget(t)}
                    aria-pressed={target === t}
                    className={cn(
                      'rounded-lg border-3 border-ink p-4 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2',
                      target === t ? 'bg-indigo-soft' : 'bg-surface hover:bg-muted'
                    )}
                  >
                    <div className="mb-1 font-bold text-ink">{TARGET_META[t].label}</div>
                    <div className="text-xs text-muted-foreground">{TARGET_META[t].hint}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Nivel (calidad / resolución) cuando influye */}
            {showLevel && (
              <div className="mt-6">
                <Label className="mb-3 block text-sm font-medium text-ink">
                  <Settings2 className="mr-2 inline h-4 w-4" />
                  {hasPdf && target !== 'pdf' ? 'Resolución y calidad' : 'Calidad'}
                </Label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {(Object.keys(LEVELS) as Level[]).map((lv) => (
                    <button
                      key={lv}
                      type="button"
                      onClick={() => setLevel(lv)}
                      aria-pressed={level === lv}
                      className={cn(
                        'rounded-lg border-3 border-ink p-4 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2',
                        level === lv ? 'bg-indigo-soft' : 'bg-surface hover:bg-muted'
                      )}
                    >
                      <div className="mb-1 font-bold text-ink">{LEVELS[lv].label}</div>
                      <div className="text-sm text-muted-foreground">{LEVELS[lv].description}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className={cn('mt-6 rounded-lg border-3 border-ink p-4', accent.soft)}>
              <p className={cn('text-sm', accent.softText)}>
                <strong>Tip:</strong>{' '}
                {target === 'pdf'
                  ? 'Cada imagen se convierte en su propio PDF. Para combinar varias en un solo documento, usa Unir.'
                  : hasPdf
                    ? 'Cada página del PDF se convierte en una imagen independiente.'
                    : 'Convierte entre formatos de imagen manteniendo la calidad que elijas.'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {files.length > 0 && results.length === 0 && (
        <Card className="mb-8">
          <CardContent className="p-4 text-center sm:p-6">
            <h2 className="mb-4 font-display text-lg font-bold text-ink">
              ¿Listo para convertir?
            </h2>
            <p className="mb-6 text-muted-foreground">
              Se convertir{files.length !== 1 ? 'án' : 'á'} {files.length} archivo
              {files.length !== 1 ? 's' : ''} a {TARGET_META[target].label}.
            </p>

            {isProcessing && (
              <div className="mx-auto mb-6 max-w-md space-y-2" aria-live="polite">
                <div className="flex items-center justify-between text-sm">
                  <span className={accent.text}>Convirtiendo…</span>
                  <span className="text-muted-foreground">{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            )}

            <Button
              onClick={convert}
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
                  <Repeat className="mr-2 h-5 w-5" />
                  Convertir a {TARGET_META[target].label}
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {results.length > 0 && (
        <Card ref={resultRef} className="motion-safe:animate-slide-up">
          <CardContent className="p-4 sm:p-6">
            <div className="mb-6 text-center">
              <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full border-3 border-ink bg-success text-white">
                <Download className="h-8 w-8" />
              </div>
              <h2 className="mb-2 text-lg font-bold text-success">
                ¡Conversión completada!
              </h2>
              <p className="mb-6 text-ink">
                Se {results.length === 1 ? 'generó' : 'generaron'} {results.length} archivo
                {results.length !== 1 ? 's' : ''} {TARGET_META[target].label}.
              </p>
              <Button onClick={downloadAll} size="lg" className={accent.solid}>
                <Download className="mr-2 h-5 w-5" />
                Descargar {results.length > 1 ? 'todo (ZIP)' : 'archivo'}
              </Button>
            </div>

            {/* Rejilla responsive: 2 columnas en móvil → 4 en escritorio. */}
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
              {results.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-col overflow-hidden rounded-lg border-3 border-ink bg-surface"
                >
                  <div className="flex aspect-[4/3] items-center justify-center border-b-3 border-ink bg-card p-2">
                    {r.previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={r.previewUrl}
                        alt={r.name}
                        className="max-h-full w-auto max-w-full object-contain"
                        loading="lazy"
                      />
                    ) : (
                      <FileText className="h-12 w-12 text-ink" aria-hidden="true" />
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2 p-2.5">
                    <span className="min-w-0 flex-1 truncate text-xs font-bold text-ink" title={r.name}>
                      {r.name}
                    </span>
                    <Button
                      onClick={() => downloadResult(r)}
                      size="sm"
                      variant="outline"
                      className="shrink-0"
                      aria-label={`Descargar ${r.name}`}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-6 text-center">
              <Button variant="outline" onClick={resetAll} size="lg">
                Convertir otros archivos
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </ToolShell>
  );
}
