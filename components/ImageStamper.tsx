'use client';

import { useState, useRef, useEffect } from 'react';
import { PDFDocument } from 'pdf-lib';
import { FileText, ImageIcon, Download, Loader2, X, Stamp } from 'lucide-react';
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

const tool = getTool('sello-imagen');
const accent = tool.accent;

type Anchor =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'middle-left'
  | 'center'
  | 'middle-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

const ANCHORS: { value: Anchor; label: string }[] = [
  { value: 'top-left', label: '↖' },
  { value: 'top-center', label: '↑' },
  { value: 'top-right', label: '↗' },
  { value: 'middle-left', label: '←' },
  { value: 'center', label: '●' },
  { value: 'middle-right', label: '→' },
  { value: 'bottom-left', label: '↙' },
  { value: 'bottom-center', label: '↓' },
  { value: 'bottom-right', label: '↘' },
];

interface ResultPDF {
  name: string;
  blob: Blob;
}

const MARGIN = 20;

export default function ImageStamper() {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [anchor, setAnchor] = useState<Anchor>('bottom-right');
  const [scale, setScale] = useState<number>(25);
  const [opacity, setOpacity] = useState<number>(100);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ResultPDF | null>(null);
  const configRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  // Libera el object URL de la vista previa al cambiarla o desmontar.
  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  useEffect(() => {
    if (pdfFile && imageFile && configRef.current) {
      setTimeout(() => scrollIntoViewSafe(configRef.current), 100);
    }
  }, [pdfFile, imageFile]);

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

  const handlePdfSelect = async (file: File) => {
    if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) {
      toast.error('Archivo no válido', {
        description: 'Por favor selecciona un archivo PDF.',
      });
      return;
    }

    setPdfFile(file);
    setResult(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer);
      setTotalPages(pdf.getPageCount());
    } catch (error) {
      console.error('Error loading PDF:', error);
      toast.error('No se pudo cargar el PDF', {
        description: 'Asegúrate de que sea un archivo válido.',
      });
      setPdfFile(null);
      setTotalPages(0);
    }
  };

  const isPng = (file: File) =>
    file.type === 'image/png' || /\.png$/i.test(file.name);
  const isJpg = (file: File) =>
    file.type === 'image/jpeg' || /\.jpe?g$/i.test(file.name);

  const handleImageSelect = (file: File) => {
    if (!isPng(file) && !isJpg(file)) {
      toast.error('Imagen no válida', {
        description: 'La imagen debe ser PNG o JPG.',
      });
      return;
    }
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageFile(file);
    setImageUrl(URL.createObjectURL(file));
    setResult(null);
  };

  const clampNumber = (value: number, min: number, max: number, fallback: number) => {
    if (Number.isNaN(value)) return fallback;
    return Math.min(max, Math.max(min, value));
  };

  const stampImage = async () => {
    if (!pdfFile || !imageFile) return;

    setIsProcessing(true);
    try {
      const pdfBuffer = await pdfFile.arrayBuffer();
      const pdf = await PDFDocument.load(pdfBuffer);

      const imgBuffer = await imageFile.arrayBuffer();
      const image = isPng(imageFile)
        ? await pdf.embedPng(imgBuffer)
        : await pdf.embedJpg(imgBuffer);

      const scalePct = clampNumber(scale, 1, 100, 25) / 100;
      const op = clampNumber(opacity, 0, 100, 100) / 100;
      const aspect = image.height / image.width;

      const pages = pdf.getPages();
      for (const page of pages) {
        const { width: pw, height: ph } = page.getSize();
        const drawW = pw * scalePct;
        const drawH = drawW * aspect;

        let x: number;
        if (anchor.endsWith('left')) {
          x = MARGIN;
        } else if (anchor.endsWith('right')) {
          x = pw - MARGIN - drawW;
        } else {
          x = (pw - drawW) / 2;
        }

        let y: number;
        if (anchor.startsWith('top')) {
          y = ph - MARGIN - drawH;
        } else if (anchor.startsWith('bottom')) {
          y = MARGIN;
        } else {
          y = (ph - drawH) / 2;
        }

        page.drawImage(image, { x, y, width: drawW, height: drawH, opacity: op });
      }

      const pdfBytes = await pdf.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      setResult({
        name: `${pdfFile.name.replace(/\.pdf$/i, '')}_sello.pdf`,
        blob,
      });
      toast.success('Sello aplicado', {
        description: `Se estampó la imagen en ${totalPages} página${totalPages !== 1 ? 's' : ''}.`,
      });
    } catch (error) {
      console.error('Error stamping image:', error);
      toast.error('No se pudo estampar la imagen', {
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

  const resetAll = () => {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setPdfFile(null);
    setTotalPages(0);
    setImageFile(null);
    setImageUrl('');
    setAnchor('bottom-right');
    setScale(25);
    setOpacity(100);
    setResult(null);
  };

  const changePdfWithUndo = () => {
    if (!pdfFile) return;
    const snap = { pdfFile, totalPages, result };
    setPdfFile(null);
    setTotalPages(0);
    setResult(null);
    toastUndo('PDF descartado', {
      description: 'Selecciona otro PDF, o recupéralo si fue un error.',
      onUndo: () => {
        setPdfFile(snap.pdfFile);
        setTotalPages(snap.totalPages);
        setResult(snap.result);
      },
    });
  };

  const changeImage = () => {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageFile(null);
    setImageUrl('');
    setResult(null);
  };

  const step: 1 | 2 | 3 = !pdfFile || !imageFile ? 1 : result ? 3 : 2;

  return (
    <ToolShell tool={tool} step={step}>
      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        {/* Zona PDF */}
        {pdfFile ? (
          <div className="flex items-center gap-3 rounded-lg border-3 border-ink bg-surface p-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded border-2 border-ink bg-card">
              <FileText className="h-6 w-6 text-ink" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-ink">{pdfFile.name}</p>
              <p className="text-sm text-muted-foreground">
                {formatFileSize(pdfFile.size)} • {totalPages} páginas
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={changePdfWithUndo}
              className="shrink-0"
              aria-label="Cambiar PDF"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <FileDropzone
            accent={accent}
            accept=".pdf,application/pdf"
            idleTitle="Selecciona el PDF"
            idleSubtitle="Haz clic o arrastra tu archivo PDF"
            dragTitle="Suelta el PDF aquí"
            buttonLabel="Seleccionar PDF"
            ariaLabel="Seleccionar o arrastrar un archivo PDF"
            onFiles={(files) => handlePdfSelect(files[0])}
          />
        )}

        {/* Zona imagen */}
        {imageFile ? (
          <div className="flex items-center gap-3 rounded-lg border-3 border-ink bg-surface p-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded border-2 border-ink bg-card">
              {/* Vista previa de la imagen subida */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt="Vista previa del sello"
                className="h-full w-full object-contain"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-ink">{imageFile.name}</p>
              <p className="text-sm text-muted-foreground">
                {formatFileSize(imageFile.size)}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={changeImage}
              className="shrink-0"
              aria-label="Cambiar imagen"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <FileDropzone
            accent={accent}
            accept="image/png,image/jpeg,.png,.jpg,.jpeg"
            idleTitle="Selecciona la imagen"
            idleSubtitle="PNG o JPG (logo, sello, firma…)"
            dragTitle="Suelta la imagen aquí"
            buttonLabel="Seleccionar imagen"
            ariaLabel="Seleccionar o arrastrar una imagen PNG o JPG"
            onFiles={(files) => handleImageSelect(files[0])}
          />
        )}
      </div>

      <ToolConstraints items={tool.constraints} />

      {pdfFile && imageFile && (
        <Card className="mb-8 motion-safe:animate-slide-up" ref={configRef}>
          <CardContent className="p-4 sm:p-6">
            <h2 className="mb-6 font-display text-lg font-bold text-ink">
              Configura el sello
            </h2>

            <div className="grid gap-6 sm:grid-cols-[auto_1fr] sm:items-start">
              {/* Selector de posición de 9 anclas */}
              <div>
                <Label className="mb-2 block">Posición</Label>
                <div
                  role="radiogroup"
                  aria-label="Posición del sello"
                  className="grid w-[132px] grid-cols-3 gap-1.5"
                >
                  {ANCHORS.map((a) => {
                    const active = anchor === a.value;
                    return (
                      <button
                        key={a.value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        aria-label={a.value}
                        onClick={() => setAnchor(a.value)}
                        className={cn(
                          'flex h-10 w-10 items-center justify-center rounded border-2 border-ink text-base font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2',
                          active
                            ? cn(accent.solid, 'border-ink')
                            : 'bg-surface text-ink hover:bg-muted'
                        )}
                      >
                        {a.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <Label htmlFor="st-scale" className="mb-2 block">
                    Tamaño: {scale}% del ancho de página
                  </Label>
                  <input
                    id="st-scale"
                    type="range"
                    min={1}
                    max={100}
                    step={1}
                    value={scale}
                    onChange={(e) => setScale(Number(e.target.value))}
                    className={cn('h-2 w-full cursor-pointer appearance-none rounded-lg border-2 border-ink', accent.soft)}
                    aria-label="Tamaño del sello"
                  />
                </div>
                <div>
                  <Label htmlFor="st-opacity" className="mb-2 block">
                    Opacidad: {opacity}%
                  </Label>
                  <input
                    id="st-opacity"
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={opacity}
                    onChange={(e) => setOpacity(Number(e.target.value))}
                    className={cn('h-2 w-full cursor-pointer appearance-none rounded-lg border-2 border-ink', accent.soft)}
                    aria-label="Opacidad del sello"
                  />
                </div>
                <div className={cn('rounded-lg border-3 border-ink p-3', accent.soft)}>
                  <p className={cn('text-sm', accent.softText)}>
                    La imagen se estampa en cada una de las {totalPages} páginas,
                    a {MARGIN}px del borde, conservando su proporción.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {pdfFile && imageFile && !result && (
        <Card className="mb-8">
          <CardContent className="p-4 text-center sm:p-6">
            <h2 className="mb-4 font-display text-lg font-bold text-ink">
              ¿Listo para estampar?
            </h2>
            <p className="mb-6 text-muted-foreground">
              Se colocará la imagen en todas las páginas del documento.
            </p>
            <Button
              onClick={stampImage}
              disabled={isProcessing}
              aria-busy={isProcessing}
              size="lg"
              className={accent.solid}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Estampando…
                </>
              ) : (
                <>
                  <Stamp className="mr-2 h-5 w-5" />
                  Estampar imagen
                </>
              )}
            </Button>
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
                ¡Sello aplicado!
              </h2>
              <p className="mb-4 text-ink">Tu PDF está listo para descargar.</p>
              <Button onClick={downloadPDF} size="lg" className={accent.solid}>
                <Download className="mr-2 h-5 w-5" />
                Descargar PDF
              </Button>
            </div>

            <div className="mt-6 text-center">
              <Button variant="outline" onClick={resetAll} size="lg">
                Procesar otro PDF
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </ToolShell>
  );
}
