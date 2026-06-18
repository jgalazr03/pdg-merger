'use client';

import { useState, useRef, useEffect } from 'react';
import { PDFDocument } from 'pdf-lib';
import { FileText, Download, Loader2, X, Crop, AlertCircle } from 'lucide-react';
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

const tool = getTool('recortar-pdf');
const accent = tool.accent;

/** 1 mm = 2.83465 pt. */
const MM_TO_PT = 2.83465;

interface Margins {
  top: string;
  bottom: string;
  left: string;
  right: string;
}

const SIDES: { key: keyof Margins; label: string }[] = [
  { key: 'top', label: 'Superior' },
  { key: 'bottom', label: 'Inferior' },
  { key: 'left', label: 'Izquierda' },
  { key: 'right', label: 'Derecha' },
];

export default function PDFCropper() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [margins, setMargins] = useState<Margins>({
    top: '0',
    bottom: '0',
    left: '0',
    right: '0',
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string>('');

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
    setMargins({ top: '0', bottom: '0', left: '0', right: '0' });
    setError('');

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer);
      setTotalPages(pdf.getPageCount());
    } catch (err) {
      console.error('Error loading PDF:', err);
      toast.error('No se pudo cargar el PDF', {
        description: 'Asegúrate de que sea un archivo válido.',
      });
      setSelectedFile(null);
      setTotalPages(0);
    }
  };

  const parseMm = (value: string): number => {
    if (!value.trim()) return 0;
    const n = parseFloat(value);
    return isNaN(n) ? NaN : n;
  };

  const setSide = (key: keyof Margins, value: string) => {
    setMargins((m) => ({ ...m, [key]: value }));
    setError('');
  };

  const cropPDF = async () => {
    if (!selectedFile) return;

    const top = parseMm(margins.top);
    const bottom = parseMm(margins.bottom);
    const left = parseMm(margins.left);
    const right = parseMm(margins.right);

    if ([top, bottom, left, right].some((v) => isNaN(v))) {
      setError('Todos los valores deben ser números (en milímetros).');
      return;
    }
    if ([top, bottom, left, right].some((v) => v < 0)) {
      setError('Los márgenes no pueden ser negativos.');
      return;
    }
    if (top + bottom + left + right === 0) {
      setError('Indica al menos un margen mayor que 0 para recortar.');
      return;
    }

    setIsProcessing(true);
    setError('');
    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer);

      const topPt = top * MM_TO_PT;
      const bottomPt = bottom * MM_TO_PT;
      const leftPt = left * MM_TO_PT;
      const rightPt = right * MM_TO_PT;

      const pages = pdf.getPages();
      let tooSmall = false;

      for (const page of pages) {
        // Partir del CropBox actual (cae al MediaBox si no hay CropBox propio).
        const box = page.getCropBox();
        const newLeft = box.x + leftPt;
        const newBottom = box.y + bottomPt;
        const newWidth = box.width - leftPt - rightPt;
        const newHeight = box.height - topPt - bottomPt;

        if (newWidth <= 0 || newHeight <= 0) {
          tooSmall = true;
          break;
        }

        page.setCropBox(newLeft, newBottom, newWidth, newHeight);
      }

      if (tooSmall) {
        setError(
          'El recorte excede el tamaño de alguna página. Reduce los márgenes.'
        );
        setIsProcessing(false);
        return;
      }

      const pdfBytes = await pdf.save();
      setResultBlob(new Blob([pdfBytes], { type: 'application/pdf' }));
      toast.success('Márgenes recortados');
    } catch (err) {
      console.error('Error cropping PDF:', err);
      toast.error('No se pudo recortar el PDF', {
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
    link.download = `${selectedFile.name.replace(/\.pdf$/i, '')}_recortado.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const resetAll = () => {
    setSelectedFile(null);
    setTotalPages(0);
    setMargins({ top: '0', bottom: '0', left: '0', right: '0' });
    setResultBlob(null);
    setError('');
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

            <div className="mt-6">
              <Label className="mb-2 block text-sm font-medium text-ink">
                <Crop className="mr-2 inline h-4 w-4" />
                Recorte por lado (en milímetros)
              </Label>
              <div className="grid grid-cols-2 gap-4">
                {SIDES.map((side) => (
                  <div key={side.key}>
                    <Label
                      htmlFor={`crop-${side.key}`}
                      className="mb-1.5 block text-sm font-normal text-muted-foreground"
                    >
                      {side.label}
                    </Label>
                    <Input
                      id={`crop-${side.key}`}
                      type="number"
                      min={0}
                      step="any"
                      inputMode="decimal"
                      value={margins[side.key]}
                      onChange={(e) => setSide(side.key, e.target.value)}
                    />
                  </div>
                ))}
              </div>

              {error && (
                <div className="mt-3 flex items-start gap-2 text-sm text-brand-red">
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div
                className={cn(
                  'mt-3 rounded-lg border-3 border-ink p-3',
                  accent.soft
                )}
              >
                <p className={cn('text-sm', accent.softText)}>
                  Se aplica el mismo recorte a las {totalPages} páginas. El
                  recorte ajusta el área visible (CropBox) sin rasterizar el
                  contenido.
                </p>
              </div>
            </div>

            <div className="mt-6 text-center">
              <Button
                onClick={cropPDF}
                disabled={isProcessing}
                aria-busy={isProcessing}
                size="lg"
                className={accent.solid}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Recortando…
                  </>
                ) : (
                  <>
                    <Crop className="mr-2 h-5 w-5" />
                    Recortar PDF
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
              ¡PDF recortado!
            </h2>
            <p className="mb-6 text-ink">
              Se ajustaron los márgenes de todas las páginas.
            </p>
            <Button onClick={downloadResult} size="lg" className={accent.solid}>
              <Download className="mr-2 h-5 w-5" />
              Descargar PDF
            </Button>
            <div className="mt-6">
              <Button variant="outline" onClick={resetAll} size="lg">
                Recortar otro PDF
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </ToolShell>
  );
}
