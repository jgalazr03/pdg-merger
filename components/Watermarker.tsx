'use client';

import { useState, useRef, useEffect } from 'react';
import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';
import { FileText, Download, Loader2, X, Droplets } from 'lucide-react';
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

const tool = getTool('marca-de-agua');
const accent = tool.accent;

interface ResultPDF {
  name: string;
  blob: Blob;
}

export default function Watermarker() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [text, setText] = useState<string>('CONFIDENCIAL');
  const [opacity, setOpacity] = useState<number>(30);
  const [rotation, setRotation] = useState<number>(45);
  const [fontSize, setFontSize] = useState<number>(50);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ResultPDF | null>(null);
  const fileInfoRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedFile && fileInfoRef.current) {
      setTimeout(() => scrollIntoViewSafe(fileInfoRef.current), 100);
    }
  }, [selectedFile]);

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

  const handleFileSelect = async (file: File) => {
    if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) {
      toast.error('Archivo no válido', {
        description: 'Por favor selecciona un archivo PDF.',
      });
      return;
    }

    setSelectedFile(file);
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
      setSelectedFile(null);
      setTotalPages(0);
    }
  };

  const clampNumber = (value: number, min: number, max: number, fallback: number) => {
    if (Number.isNaN(value)) return fallback;
    return Math.min(max, Math.max(min, value));
  };

  const applyWatermark = async () => {
    if (!selectedFile) return;

    if (!text.trim()) {
      toast.error('Falta el texto', {
        description: 'Escribe el texto de la marca de agua.',
      });
      return;
    }

    setIsProcessing(true);
    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer);
      const font = await pdf.embedFont(StandardFonts.HelveticaBold);

      const op = clampNumber(opacity, 0, 100, 30) / 100;
      const rot = clampNumber(rotation, -360, 360, 45);
      const size = clampNumber(fontSize, 6, 400, 50);
      const rad = (rot * Math.PI) / 180;
      const label = text.trim();

      const textWidth = font.widthOfTextAtSize(label, size);
      const textHeight = font.heightAtSize(size);

      const pages = pdf.getPages();
      for (const page of pages) {
        const { width, height } = page.getSize();
        // Punto de anclaje del texto para que el centro de la cadena (girada en
        // torno a ese punto) caiga en el centro de la página.
        const x =
          width / 2 -
          (textWidth / 2) * Math.cos(rad) +
          (textHeight / 2) * Math.sin(rad);
        const y =
          height / 2 -
          (textWidth / 2) * Math.sin(rad) -
          (textHeight / 2) * Math.cos(rad);

        page.drawText(label, {
          x,
          y,
          size,
          font,
          color: rgb(0.5, 0.5, 0.5),
          opacity: op,
          rotate: degrees(rot),
        });
      }

      const pdfBytes = await pdf.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      setResult({
        name: `${selectedFile.name.replace(/\.pdf$/i, '')}_marca-de-agua.pdf`,
        blob,
      });
      toast.success('Marca de agua aplicada', {
        description: `Se estampó "${label}" en ${totalPages} página${totalPages !== 1 ? 's' : ''}.`,
      });
    } catch (error) {
      console.error('Error applying watermark:', error);
      toast.error('No se pudo aplicar la marca de agua', {
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
    setSelectedFile(null);
    setTotalPages(0);
    setText('CONFIDENCIAL');
    setOpacity(30);
    setRotation(45);
    setFontSize(50);
    setResult(null);
  };

  const changeFileWithUndo = () => {
    if (!selectedFile) return;
    const snap = { selectedFile, totalPages, text, opacity, rotation, fontSize, result };
    resetAll();
    toastUndo('Archivo descartado', {
      description: 'Selecciona otro PDF, o recupéralo si fue un error.',
      onUndo: () => {
        setSelectedFile(snap.selectedFile);
        setTotalPages(snap.totalPages);
        setText(snap.text);
        setOpacity(snap.opacity);
        setRotation(snap.rotation);
        setFontSize(snap.fontSize);
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
                <p className="truncate font-medium text-ink">{selectedFile.name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatFileSize(selectedFile.size)} • {totalPages} páginas
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-5">
              <div>
                <Label htmlFor="wm-text" className="mb-2 block">
                  <Droplets className="mr-2 inline h-4 w-4" />
                  Texto de la marca de agua
                </Label>
                <Input
                  id="wm-text"
                  type="text"
                  placeholder="CONFIDENCIAL"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-3">
                <div>
                  <Label htmlFor="wm-opacity" className="mb-2 block">
                    Opacidad: {opacity}%
                  </Label>
                  <input
                    id="wm-opacity"
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={opacity}
                    onChange={(e) => setOpacity(Number(e.target.value))}
                    className={cn('h-2 w-full cursor-pointer appearance-none rounded-lg border-2 border-ink', accent.soft)}
                    aria-label="Opacidad de la marca de agua"
                  />
                </div>
                <div>
                  <Label htmlFor="wm-rotation" className="mb-2 block">
                    Rotación (°)
                  </Label>
                  <Input
                    id="wm-rotation"
                    type="number"
                    min={-360}
                    max={360}
                    value={rotation}
                    onChange={(e) => setRotation(Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="wm-size" className="mb-2 block">
                    Tamaño de fuente
                  </Label>
                  <Input
                    id="wm-size"
                    type="number"
                    min={6}
                    max={400}
                    value={fontSize}
                    onChange={(e) => setFontSize(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className={cn('rounded-lg border-3 border-ink p-3', accent.soft)}>
                <p className={cn('text-sm', accent.softText)}>
                  La marca se dibuja centrada y en diagonal sobre cada una de las{' '}
                  {totalPages} páginas, en gris translúcido.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedFile && !result && (
        <Card className="mb-8">
          <CardContent className="p-4 text-center sm:p-6">
            <h2 className="mb-4 font-display text-lg font-bold text-ink">
              ¿Listo para estampar?
            </h2>
            <p className="mb-6 text-muted-foreground">
              Se aplicará la marca de agua a todas las páginas del documento.
            </p>
            <Button
              onClick={applyWatermark}
              disabled={isProcessing}
              aria-busy={isProcessing}
              size="lg"
              className={accent.solid}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Aplicando…
                </>
              ) : (
                <>
                  <Droplets className="mr-2 h-5 w-5" />
                  Añadir marca de agua
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
                ¡Marca de agua añadida!
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
