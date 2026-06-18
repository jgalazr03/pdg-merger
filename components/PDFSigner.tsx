'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { PDFDocument } from 'pdf-lib';
import {
  FileText,
  Download,
  Loader2,
  X,
  PenTool,
  AlertCircle,
  Eraser,
  Image as ImageIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn, scrollIntoViewSafe } from '@/lib/utils';
import { toastUndo } from '@/lib/toast';
import { getTool } from '@/lib/tools';
import ToolShell from '@/components/tools/ToolShell';
import FileDropzone from '@/components/tools/FileDropzone';
import ToolConstraints from '@/components/tools/ToolConstraints';

const tool = getTool('firmar-pdf');
const accent = tool.accent;

/** Trazo navy del lienzo (mismo navy del sistema, --ink ≈ rgb(15,23,42)). */
const STROKE = 'rgb(15, 23, 42)';
const STROKE_WIDTH = 2.5;
/** Alto fijo del lienzo en CSS px (el ancho es 100% del contenedor). */
const CANVAS_CSS_HEIGHT = 200;

type Anchor =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'center'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

const ANCHORS: { value: Anchor; label: string }[] = [
  { value: 'top-left', label: 'Sup. izq.' },
  { value: 'top-center', label: 'Sup. centro' },
  { value: 'top-right', label: 'Sup. der.' },
  { value: 'center', label: 'Centro' },
  { value: 'bottom-left', label: 'Inf. izq.' },
  { value: 'bottom-center', label: 'Inf. centro' },
  { value: 'bottom-right', label: 'Inf. der.' },
];

export default function PDFSigner() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);

  // Firma: el usuario dibuja en el lienzo, o sube una imagen PNG.
  const [hasDrawing, setHasDrawing] = useState(false);
  const [uploadedPng, setUploadedPng] = useState<string | null>(null);
  const [uploadedName, setUploadedName] = useState<string>('');

  // Opciones de colocación.
  const [targetPage, setTargetPage] = useState<string>('1');
  const [anchor, setAnchor] = useState<Anchor>('bottom-right');
  const [sizePct, setSizePct] = useState<number>(30);
  const [pageError, setPageError] = useState<string>('');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  const fileInfoRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedFile && fileInfoRef.current) {
      setTimeout(() => scrollIntoViewSafe(fileInfoRef.current), 100);
    }
  }, [selectedFile]);

  useEffect(() => {
    if (resultBlob) {
      setTimeout(() => scrollIntoViewSafe(resultRef.current), 100);
    }
  }, [resultBlob]);

  // --- Lienzo: configura tamaño real según devicePixelRatio para nitidez. ---
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = STROKE;
    ctx.lineWidth = STROKE_WIDTH;
  }, []);

  useEffect(() => {
    if (!selectedFile) return;
    setupCanvas();
    const onResize = () => {
      // Reconfigurar pierde el trazo; solo importa antes de dibujar.
      if (!hasDrawing) setupCanvas();
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [selectedFile, setupCanvas, hasDrawing]);

  const pointerPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    // Coordenadas en CSS px relativas al lienzo (la transform ya escala por dpr).
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (uploadedPng) return; // Si hay imagen subida, el lienzo no se usa.
    e.preventDefault();
    canvasRef.current?.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    const p = pointerPos(e);
    lastPointRef.current = p;
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      // Punto inicial (permite firmar un punto/clic).
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + 0.01, p.y + 0.01);
      ctx.stroke();
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext('2d');
    const last = lastPointRef.current;
    if (!ctx || !last) return;
    const p = pointerPos(e);
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastPointRef.current = p;
    if (!hasDrawing) setHasDrawing(true);
  };

  const endStroke = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastPointRef.current = null;
    try {
      canvasRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* el puntero pudo no estar capturado */
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
    setHasDrawing(false);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleFileSelect = async (file: File) => {
    if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) {
      toast.error('Archivo no válido', {
        description: 'Por favor selecciona un archivo PDF.',
      });
      return;
    }

    setSelectedFile(file);
    setResultBlob(null);
    setUploadedPng(null);
    setUploadedName('');
    setHasDrawing(false);
    setTargetPage('1');
    setAnchor('bottom-right');
    setSizePct(30);
    setPageError('');

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer);
      setTotalPages(pdf.getPageCount());
    } catch (error) {
      console.error('Error loading PDF:', error);
      toast.error('No se pudo cargar el PDF', {
        description: 'Asegúrate de que sea un archivo válido.',
      });
      setSelectedFile(null);
      setTotalPages(0);
    }
  };

  const handlePngUpload = (file: File) => {
    if (file.type !== 'image/png' && !/\.png$/i.test(file.name)) {
      toast.error('Imagen no válida', {
        description: 'Sube una imagen PNG (idealmente con fondo transparente).',
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setUploadedPng(reader.result as string);
      setUploadedName(file.name);
      clearCanvas();
    };
    reader.onerror = () => {
      toast.error('No se pudo leer la imagen', {
        description: 'Inténtalo de nuevo.',
      });
    };
    reader.readAsDataURL(file);
  };

  const removeUploadedPng = () => {
    setUploadedPng(null);
    setUploadedName('');
    // Reconfigura el lienzo para volver a dibujar.
    setTimeout(setupCanvas, 0);
  };

  const validatePage = (value: string): number | null => {
    const n = parseInt(value, 10);
    if (isNaN(n)) {
      setPageError('Indica un número de página.');
      return null;
    }
    if (n < 1 || n > totalPages) {
      setPageError(`La página debe estar entre 1 y ${totalPages}.`);
      return null;
    }
    setPageError('');
    return n;
  };

  const handlePageChange = (value: string) => {
    setTargetPage(value);
    if (value.trim() && totalPages > 0) validatePage(value);
    else setPageError('');
  };

  /** Bytes PNG de la firma (lienzo dibujado o imagen subida). */
  const getSignaturePngBytes = async (): Promise<Uint8Array | null> => {
    if (uploadedPng) {
      const res = await fetch(uploadedPng);
      const buf = await res.arrayBuffer();
      return new Uint8Array(buf);
    }
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawing) return null;
    const dataUrl = canvas.toDataURL('image/png');
    const res = await fetch(dataUrl);
    const buf = await res.arrayBuffer();
    return new Uint8Array(buf);
  };

  const signPDF = async () => {
    if (!selectedFile) return;
    const page = validatePage(targetPage);
    if (page == null) return;

    if (!uploadedPng && !hasDrawing) {
      toast.error('Falta la firma', {
        description: 'Dibuja tu firma o sube una imagen PNG.',
      });
      return;
    }

    setIsProcessing(true);
    try {
      const pngBytes = await getSignaturePngBytes();
      if (!pngBytes) {
        toast.error('No se pudo obtener la firma');
        setIsProcessing(false);
        return;
      }

      const arrayBuffer = await selectedFile.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer);
      const pngImage = await pdf.embedPng(pngBytes);

      const target = pdf.getPage(page - 1);
      const { width: pw, height: ph } = target.getSize();

      // Ancho de la firma = sizePct % del ancho de la página; alto a proporción.
      const sigWidth = (pw * sizePct) / 100;
      const sigHeight = (sigWidth * pngImage.height) / pngImage.width;

      const margin = 24;
      let x = margin;
      let y = margin;

      // Horizontal (origen abajo-izquierda en pdf-lib).
      if (anchor.endsWith('left')) x = margin;
      else if (anchor.endsWith('right')) x = pw - sigWidth - margin;
      else x = (pw - sigWidth) / 2; // center / *-center

      // Vertical.
      if (anchor.startsWith('top')) y = ph - sigHeight - margin;
      else if (anchor.startsWith('bottom')) y = margin;
      else y = (ph - sigHeight) / 2; // center

      target.drawImage(pngImage, {
        x,
        y,
        width: sigWidth,
        height: sigHeight,
      });

      const pdfBytes = await pdf.save();
      setResultBlob(new Blob([pdfBytes], { type: 'application/pdf' }));
      toast.success('Firma añadida al PDF');
    } catch (error) {
      console.error('Error signing PDF:', error);
      toast.error('No se pudo firmar el PDF', {
        description: 'Inténtalo de nuevo.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadResult = () => {
    if (!resultBlob || !selectedFile) return;
    const url = URL.createObjectURL(resultBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selectedFile.name.replace(/\.pdf$/i, '')}_firmado.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const resetAll = () => {
    setSelectedFile(null);
    setTotalPages(0);
    setResultBlob(null);
    setUploadedPng(null);
    setUploadedName('');
    setHasDrawing(false);
    setTargetPage('1');
    setAnchor('bottom-right');
    setSizePct(30);
    setPageError('');
  };

  const changeFileWithUndo = () => {
    if (!selectedFile) return;
    const snap = { selectedFile, totalPages };
    resetAll();
    toastUndo('Archivo descartado', {
      description: 'Selecciona otro PDF, o recupéralo si fue un error.',
      onUndo: () => {
        setSelectedFile(snap.selectedFile);
        setTotalPages(snap.totalPages);
      },
    });
  };

  const step: 1 | 2 | 3 = !selectedFile ? 1 : resultBlob ? 3 : 2;

  return (
    <ToolShell tool={tool} step={step}>
      <FileDropzone
        className="mb-4"
        accent={accent}
        loaded={step > 1}
        accept=".pdf,application/pdf"
        idleTitle="Selecciona un archivo PDF"
        idleSubtitle="Haz clic aquí o arrastra y suelta tu archivo PDF"
        dragTitle="Suelta el archivo PDF aquí"
        buttonLabel="Seleccionar archivo"
        ariaLabel="Seleccionar o arrastrar un archivo PDF"
        onFiles={(files) => handleFileSelect(files[0])}
      />

      <ToolConstraints items={tool.constraints} />

      {selectedFile && !resultBlob && (
        <Card className="mb-8 motion-safe:animate-slide-up" ref={fileInfoRef}>
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
                <p className="truncate font-medium text-ink">
                  {selectedFile.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatFileSize(selectedFile.size)} • {totalPages} páginas
                </p>
              </div>
            </div>

            {/* --- Firma --- */}
            <div className="mt-6">
              <Label className="mb-2 block text-sm font-medium text-ink">
                <PenTool className="mr-2 inline h-4 w-4" />
                Dibuja tu firma
              </Label>

              <div
                className={cn(
                  'relative overflow-hidden rounded-lg border-3 border-ink bg-surface',
                  uploadedPng && 'opacity-50'
                )}
              >
                <canvas
                  ref={canvasRef}
                  className="block w-full touch-none"
                  style={{ height: CANVAS_CSS_HEIGHT }}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={endStroke}
                  onPointerLeave={endStroke}
                  onPointerCancel={endStroke}
                  aria-label="Lienzo para dibujar la firma"
                />
                {!hasDrawing && !uploadedPng && (
                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                    Firma aquí con el dedo o el ratón
                  </span>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearCanvas}
                  disabled={!hasDrawing || !!uploadedPng}
                >
                  <Eraser className="mr-2 h-4 w-4" />
                  Limpiar
                </Button>
                <span className="text-sm text-muted-foreground">o</span>
                <label
                  className={cn(
                    'inline-flex h-9 cursor-pointer items-center rounded-lg border-3 border-ink bg-surface px-3 text-sm font-bold text-ink transition-[transform,background-color] hover-fine:bg-muted active:scale-[0.98]'
                  )}
                >
                  <ImageIcon className="mr-2 h-4 w-4" />
                  Subir imagen PNG
                  <input
                    type="file"
                    accept=".png,image/png"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        handlePngUpload(e.target.files[0]);
                      }
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>

              {uploadedPng && (
                <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border-3 border-ink bg-surface p-3">
                  <div className="flex min-w-0 items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={uploadedPng}
                      alt="Firma subida"
                      className="h-10 w-auto max-w-[120px] shrink-0 rounded border-2 border-ink bg-card object-contain"
                    />
                    <p className="truncate text-sm font-medium text-ink">
                      {uploadedName}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={removeUploadedPng}
                    className="shrink-0"
                  >
                    <X className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Quitar</span>
                  </Button>
                </div>
              )}
            </div>

            {/* --- Colocación --- */}
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div>
                <Label
                  htmlFor="target-page"
                  className="mb-2 block text-sm font-medium text-ink"
                >
                  Página de destino
                </Label>
                <Input
                  id="target-page"
                  type="number"
                  min={1}
                  max={totalPages}
                  value={targetPage}
                  onChange={(e) => handlePageChange(e.target.value)}
                  aria-invalid={!!pageError}
                  className={cn(pageError && 'border-brand-red')}
                />
                {pageError && (
                  <div className="mt-2 flex items-start gap-2 text-sm text-brand-red">
                    <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <span>{pageError}</span>
                  </div>
                )}
              </div>

              <div>
                <Label
                  htmlFor="sig-size"
                  className="mb-2 block text-sm font-medium text-ink"
                >
                  Tamaño de la firma: {sizePct}% del ancho
                </Label>
                <input
                  id="sig-size"
                  type="range"
                  min={10}
                  max={60}
                  step={1}
                  value={sizePct}
                  onChange={(e) => setSizePct(parseInt(e.target.value, 10))}
                  className="h-10 w-full cursor-pointer accent-ink"
                />
              </div>
            </div>

            <div className="mt-4">
              <Label className="mb-2 block text-sm font-medium text-ink">
                Posición en la página
              </Label>
              <div className="grid grid-cols-3 gap-2">
                {ANCHORS.map((a) => (
                  <button
                    key={a.value}
                    type="button"
                    onClick={() => setAnchor(a.value)}
                    aria-pressed={anchor === a.value}
                    className={cn(
                      'rounded-lg border-3 border-ink px-2 py-2 text-sm font-bold transition-[transform,background-color,color] active:scale-[0.98]',
                      anchor === a.value
                        ? accent.solid
                        : 'bg-surface text-ink hover-fine:bg-muted'
                    )}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 text-center">
              <Button
                onClick={signPDF}
                disabled={isProcessing}
                aria-busy={isProcessing}
                size="lg"
                className={accent.solid}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Firmando…
                  </>
                ) : (
                  <>
                    <PenTool className="mr-2 h-5 w-5" />
                    Firmar PDF
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {resultBlob && (
        <Card ref={resultRef} className="motion-safe:animate-slide-up">
          <CardContent className="p-4 text-center sm:p-6">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full border-3 border-ink bg-success text-white">
              <Download className="h-8 w-8" />
            </div>
            <h2 className="mb-2 text-lg font-bold text-success">
              ¡PDF firmado!
            </h2>
            <p className="mb-6 text-ink">
              Tu firma se colocó en la página indicada.
            </p>
            <Button onClick={downloadResult} size="lg" className={accent.solid}>
              <Download className="mr-2 h-5 w-5" />
              Descargar PDF
            </Button>
            <div className="mt-6">
              <Button variant="outline" onClick={resetAll} size="lg">
                Firmar otro PDF
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </ToolShell>
  );
}
