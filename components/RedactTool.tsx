'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import {
  EyeOff,
  Download,
  Loader2,
  X,
  Undo2,
  Eraser,
  ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn, scrollIntoViewSafe } from '@/lib/utils';
import { getTool } from '@/lib/tools';
import ToolShell from '@/components/tools/ToolShell';
import FileDropzone from '@/components/tools/FileDropzone';
import ToolConstraints from '@/components/tools/ToolConstraints';

const tool = getTool('censurar-pdf');
const accent = tool.accent;

// Escala de rasterizado para exportar (nitidez sin disparar memoria) y escala
// más ligera para el render del editor en pantalla.
const RENDER_SCALE = 2;
const DISPLAY_SCALE = 1.5;
const JPEG_QUALITY = 0.85;
// Ignora cajas accidentales (un simple clic) menores a este tamaño normalizado.
const MIN_BOX = 0.012;

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

// Caja de censura en coordenadas normalizadas (0..1), origen arriba-izquierda.
interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface ResultPDF {
  name: string;
  blob: Blob;
  redactedPages: number;
}

/**
 * Reconstruye el PDF: las páginas SIN cajas se copian tal cual (conservan su
 * texto seleccionable); las páginas CON cajas se rasterizan a imagen con las
 * cajas pintadas en negro, de modo que el texto tapado deja de existir como
 * texto (no es extraíble ni buscable). Reaprovecha el pipeline de escala-grises.
 */
async function exportRedacted(
  doc: PDFDocumentProxy,
  file: File,
  boxesByPage: Box[][],
  onProgress: (pct: number) => void
): Promise<Blob> {
  const { PDFDocument } = await import('pdf-lib');
  const srcLib = await PDFDocument.load(await file.arrayBuffer());
  const out = await PDFDocument.create();

  for (let n = 1; n <= doc.numPages; n++) {
    const boxes = boxesByPage[n - 1] ?? [];
    if (boxes.length === 0) {
      const [copied] = await out.copyPages(srcLib, [n - 1]);
      out.addPage(copied);
    } else {
      const page = await doc.getPage(n);
      const viewport = page.getViewport({ scale: RENDER_SCALE });
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;

      // Pinta las cajas en negro sólido SOBRE el bitmap: aquí se destruye el
      // texto de verdad (todo en espacio de canvas, origen arriba-izquierda).
      ctx.fillStyle = '#000000';
      for (const b of boxes) {
        ctx.fillRect(
          b.x * canvas.width,
          b.y * canvas.height,
          b.w * canvas.width,
          b.h * canvas.height
        );
      }

      const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
      const bytes = Uint8Array.from(atob(dataUrl.split(',')[1]), (c) =>
        c.charCodeAt(0)
      );
      const img = await out.embedJpg(bytes);
      const wPts = viewport.width / RENDER_SCALE;
      const hPts = viewport.height / RENDER_SCALE;
      out
        .addPage([wPts, hPts])
        .drawImage(img, { x: 0, y: 0, width: wPts, height: hPts });

      canvas.width = 0;
      canvas.height = 0;
    }
    onProgress(Math.round((n / doc.numPages) * 100));
  }

  const saved = await out.save();
  return new Blob([saved], { type: 'application/pdf' });
}

interface RedactPageProps {
  doc: PDFDocumentProxy;
  pageIndex: number;
  boxes: Box[];
  disabled: boolean;
  onCommit: (pageIndex: number, box: Box) => void;
  onUndo: (pageIndex: number) => void;
  onClear: (pageIndex: number) => void;
}

function RedactPage({
  doc,
  pageIndex,
  boxes,
  disabled,
  onCommit,
  onUndo,
  onClear,
}: RedactPageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const renderedRef = useRef(false);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const [draft, setDraft] = useState<Box | null>(null);

  useEffect(() => {
    if (renderedRef.current) return;
    renderedRef.current = true;
    let cancelled = false;
    (async () => {
      const page = await doc.getPage(pageIndex + 1);
      if (cancelled) return;
      const viewport = page.getViewport({ scale: DISPLAY_SCALE });
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
    })();
    return () => {
      cancelled = true;
    };
  }, [doc, pageIndex]);

  const normalize = (e: React.PointerEvent) => {
    const rect = overlayRef.current!.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    return {
      x: Math.min(1, Math.max(0, x)),
      y: Math.min(1, Math.max(0, y)),
    };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    e.preventDefault();
    overlayRef.current!.setPointerCapture(e.pointerId);
    const p = normalize(e);
    startRef.current = p;
    setDraft({ x: p.x, y: p.y, w: 0, h: 0 });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!startRef.current) return;
    const p = normalize(e);
    const s = startRef.current;
    setDraft({
      x: Math.min(s.x, p.x),
      y: Math.min(s.y, p.y),
      w: Math.abs(p.x - s.x),
      h: Math.abs(p.y - s.y),
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!startRef.current) return;
    try {
      overlayRef.current!.releasePointerCapture(e.pointerId);
    } catch {
      // el puntero ya se soltó
    }
    const d = draft;
    startRef.current = null;
    setDraft(null);
    if (d && d.w > MIN_BOX && d.h > MIN_BOX) onCommit(pageIndex, d);
  };

  return (
    <div className="rounded-lg border-3 border-ink bg-surface p-2">
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <span className="text-sm font-bold text-ink">
          Página {pageIndex + 1}
          {boxes.length > 0 && (
            <span className={cn('ml-2 font-medium', accent.text)}>
              · {boxes.length} caja{boxes.length !== 1 ? 's' : ''}
            </span>
          )}
        </span>
        {boxes.length > 0 && !disabled && (
          <span className="flex gap-1">
            <Button variant="outline" size="sm" onClick={() => onUndo(pageIndex)}>
              <Undo2 className="mr-1 h-3.5 w-3.5" />
              Deshacer
            </Button>
            <Button variant="outline" size="sm" onClick={() => onClear(pageIndex)}>
              <Eraser className="mr-1 h-3.5 w-3.5" />
              Limpiar
            </Button>
          </span>
        )}
      </div>
      <div className="relative select-none">
        <canvas
          ref={canvasRef}
          className="block h-auto w-full rounded border-2 border-ink"
        />
        <div
          ref={overlayRef}
          className={cn(
            'absolute inset-0 rounded',
            disabled ? 'cursor-default' : 'cursor-crosshair'
          )}
          style={{ touchAction: 'none' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {boxes.map((b, i) => (
            <div
              key={i}
              className="absolute"
              style={{
                left: `${b.x * 100}%`,
                top: `${b.y * 100}%`,
                width: `${b.w * 100}%`,
                height: `${b.h * 100}%`,
                backgroundColor: '#000000',
              }}
            />
          ))}
          {draft && (
            <div
              className="absolute border-2 border-dashed border-white"
              style={{
                left: `${draft.x * 100}%`,
                top: `${draft.y * 100}%`,
                width: `${draft.w * 100}%`,
                height: `${draft.h * 100}%`,
                backgroundColor: 'rgba(0,0,0,0.55)',
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default function RedactTool() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [boxesByPage, setBoxesByPage] = useState<Box[][]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ResultPDF | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (doc) setTimeout(() => scrollIntoViewSafe(editorRef.current), 100);
  }, [doc]);

  useEffect(() => {
    if (result) setTimeout(() => scrollIntoViewSafe(resultRef.current), 100);
  }, [result]);

  const resetAll = () => {
    setSelectedFile(null);
    setDoc(null);
    setBoxesByPage([]);
    setResult(null);
    setProgress(0);
  };

  const handleFileSelect = async (file: File) => {
    if (!file) return;
    if (!isPdf(file)) {
      toast.error('Archivo no válido', {
        description: 'Por favor selecciona un archivo PDF.',
      });
      return;
    }
    resetAll();
    setSelectedFile(file);
    setIsLoading(true);
    try {
      const pdfjsLib = await loadPdfjs();
      const loaded = await pdfjsLib.getDocument({ data: await file.arrayBuffer() })
        .promise;
      setDoc(loaded);
      setBoxesByPage(Array.from({ length: loaded.numPages }, () => []));
    } catch (error) {
      console.error('Error abriendo el PDF:', error);
      toast.error('No se pudo abrir el PDF', {
        description: 'Asegúrate de que sea un archivo válido.',
      });
      resetAll();
    } finally {
      setIsLoading(false);
    }
  };

  const commitBox = useCallback((pageIndex: number, box: Box) => {
    setBoxesByPage((prev) =>
      prev.map((arr, i) => (i === pageIndex ? [...arr, box] : arr))
    );
  }, []);

  const undoBox = useCallback((pageIndex: number) => {
    setBoxesByPage((prev) =>
      prev.map((arr, i) => (i === pageIndex ? arr.slice(0, -1) : arr))
    );
  }, []);

  const clearPage = useCallback((pageIndex: number) => {
    setBoxesByPage((prev) => prev.map((arr, i) => (i === pageIndex ? [] : arr)));
  }, []);

  const totalBoxes = boxesByPage.reduce((sum, a) => sum + a.length, 0);
  const redactedPages = boxesByPage.filter((a) => a.length > 0).length;

  const handleExport = async () => {
    if (!selectedFile || !doc) return;
    if (totalBoxes === 0) {
      toast.error('No has marcado nada', {
        description: 'Dibuja al menos una caja sobre lo que quieras ocultar.',
      });
      return;
    }
    setIsProcessing(true);
    setProgress(0);
    try {
      const blob = await exportRedacted(doc, selectedFile, boxesByPage, setProgress);
      setResult({
        name: `${selectedFile.name.replace(/\.pdf$/i, '')}_censurado.pdf`,
        blob,
        redactedPages,
      });
      toast.success('PDF censurado', {
        description: `Se aplicó censura en ${redactedPages} página${redactedPages !== 1 ? 's' : ''}.`,
      });
    } catch (error) {
      console.error('Error censurando el PDF:', error);
      toast.error('No se pudo censurar el PDF', {
        description: 'Inténtalo de nuevo.',
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

  const step: 1 | 2 | 3 = !selectedFile ? 1 : result ? 3 : 2;

  return (
    <ToolShell tool={tool} step={step}>
      <FileDropzone
        className="mb-4"
        accent={accent}
        accept=".pdf,application/pdf"
        idleTitle="Selecciona un archivo PDF"
        idleSubtitle="Haz clic aquí o arrastra y suelta el PDF a censurar"
        dragTitle="Suelta el archivo PDF aquí"
        buttonLabel="Seleccionar archivo"
        ariaLabel="Seleccionar o arrastrar un archivo PDF"
        onFiles={(files) => handleFileSelect(files[0])}
      />

      <ToolConstraints items={tool.constraints} />

      {isLoading && (
        <Card className="mb-8">
          <CardContent className="flex flex-col items-center py-16 text-center">
            <Loader2 className={cn('h-8 w-8 animate-spin', accent.text)} />
            <p className="mt-4 text-muted-foreground">Abriendo el PDF…</p>
          </CardContent>
        </Card>
      )}

      {doc && !result && (
        <Card ref={editorRef} className="mb-8 motion-safe:animate-slide-up">
          <CardContent className="p-4 sm:p-6">
            <div className="mb-4 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="font-display text-lg font-bold text-ink">
                {totalBoxes} caja{totalBoxes !== 1 ? 's' : ''} en {redactedPages}{' '}
                página{redactedPages !== 1 ? 's' : ''}
              </h2>
              <Button
                variant="outline"
                size="sm"
                onClick={resetAll}
                disabled={isProcessing}
                className="shrink-0"
              >
                <X className="mr-2 h-4 w-4" />
                Cambiar archivo
              </Button>
            </div>

            <div
              className={cn(
                'mb-5 flex items-start gap-3 rounded-lg border-3 border-ink p-3',
                accent.soft
              )}
            >
              <ShieldAlert className={cn('mt-0.5 h-5 w-5 shrink-0', accent.text)} />
              <p className={cn('text-sm', accent.softText)}>
                Arrastra para dibujar cajas sobre lo que quieras ocultar. Al
                exportar, las páginas con cajas se convierten en imagen y el texto
                tapado se elimina de verdad (deja de poder copiarse o buscarse). Las
                páginas sin cajas conservan su texto seleccionable.
              </p>
            </div>

            <div className="space-y-4">
              {boxesByPage.map((boxes, i) => (
                <RedactPage
                  key={i}
                  doc={doc}
                  pageIndex={i}
                  boxes={boxes}
                  disabled={isProcessing}
                  onCommit={commitBox}
                  onUndo={undoBox}
                  onClear={clearPage}
                />
              ))}
            </div>

            <div className="mt-6 text-center">
              <Button
                onClick={handleExport}
                disabled={isProcessing || totalBoxes === 0}
                aria-busy={isProcessing}
                size="lg"
                className={accent.solid}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Censurando…
                  </>
                ) : (
                  <>
                    <EyeOff className="mr-2 h-5 w-5" />
                    Censurar y descargar
                  </>
                )}
              </Button>

              {isProcessing && (
                <div className="mx-auto mt-4 max-w-md">
                  <div className="h-2 w-full overflow-hidden rounded-full border-2 border-ink bg-surface">
                    <div
                      className={cn('h-full transition-all', accent.line)}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Procesando… {progress}%
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card ref={resultRef} className="motion-safe:animate-slide-up">
          <CardContent className="p-4 sm:p-6">
            <div className="mb-6 text-center">
              <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full border-3 border-ink bg-success text-white">
                <Download className="h-8 w-8" />
              </div>
              <h2 className="mb-2 text-lg font-bold text-success">
                ¡PDF censurado!
              </h2>
              <p className="mb-1 text-ink">
                Se censuraron {result.redactedPages} página
                {result.redactedPages !== 1 ? 's' : ''}. El texto tapado ya no
                existe en el archivo.
              </p>
              <div className="mt-3">
                <Button onClick={downloadPDF} size="lg" className={accent.solid}>
                  <Download className="mr-2 h-5 w-5" />
                  Descargar PDF
                </Button>
              </div>
            </div>

            <div className="mt-6 text-center">
              <Button variant="outline" onClick={resetAll} size="lg">
                Censurar otro PDF
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </ToolShell>
  );
}
