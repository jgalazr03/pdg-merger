'use client';

import { useState, useRef, useEffect } from 'react';
import { PDFDocument } from 'pdf-lib';
import {
  FileText,
  Download,
  Loader2,
  X,
  Scaling,
  AlertCircle,
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

const tool = getTool('redimensionar-pdf');
const accent = tool.accent;

type TargetKey = 'a4' | 'carta' | 'oficio' | 'porcentaje';

const FIXED_SIZES: Record<
  Exclude<TargetKey, 'porcentaje'>,
  { label: string; width: number; height: number }
> = {
  a4: { label: 'A4 (595 × 842 pt)', width: 595, height: 842 },
  carta: { label: 'Carta (612 × 792 pt)', width: 612, height: 792 },
  oficio: { label: 'Oficio (612 × 1008 pt)', width: 612, height: 1008 },
};

const OPTIONS: { key: TargetKey; label: string }[] = [
  { key: 'a4', label: FIXED_SIZES.a4.label },
  { key: 'carta', label: FIXED_SIZES.carta.label },
  { key: 'oficio', label: FIXED_SIZES.oficio.label },
  { key: 'porcentaje', label: 'Porcentaje' },
];

export default function PDFResizer() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [target, setTarget] = useState<TargetKey>('a4');
  const [percent, setPercent] = useState<string>('100');
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
    setTarget('a4');
    setPercent('100');
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

  const resizePDF = async () => {
    if (!selectedFile) return;

    let pct = 100;
    if (target === 'porcentaje') {
      pct = parseFloat(percent);
      if (isNaN(pct)) {
        setError('Indica un porcentaje válido.');
        return;
      }
      if (pct < 1 || pct > 500) {
        setError('El porcentaje debe estar entre 1 y 500.');
        return;
      }
    }

    setIsProcessing(true);
    setError('');
    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const srcPdf = await PDFDocument.load(arrayBuffer);

      if (target === 'porcentaje') {
        // Escala cada página in situ (tamaño y contenido) por el factor.
        const factor = pct / 100;
        const pages = srcPdf.getPages();
        for (const page of pages) {
          page.scale(factor, factor);
        }
        const pdfBytes = await srcPdf.save();
        setResultBlob(new Blob([pdfBytes], { type: 'application/pdf' }));
      } else {
        // Tamaño fijo: páginas nuevas del tamaño destino, contenido centrado y
        // escalado para encajar manteniendo proporción.
        const { width: tw, height: th } = FIXED_SIZES[target];
        const outPdf = await PDFDocument.create();
        const srcCount = srcPdf.getPageCount();
        const indices = Array.from({ length: srcCount }, (_, i) => i);
        const embedded = await outPdf.embedPdf(srcPdf, indices);

        for (const emb of embedded) {
          const page = outPdf.addPage([tw, th]);
          const scale = Math.min(
            emb.width === 0 ? 1 : tw / emb.width,
            emb.height === 0 ? 1 : th / emb.height
          );
          const drawW = emb.width * scale;
          const drawH = emb.height * scale;
          const x = (tw - drawW) / 2;
          const y = (th - drawH) / 2;
          page.drawPage(emb, { x, y, xScale: scale, yScale: scale });
        }
        const pdfBytes = await outPdf.save();
        setResultBlob(new Blob([pdfBytes], { type: 'application/pdf' }));
      }

      toast.success('Tamaño aplicado');
    } catch (err) {
      console.error('Error resizing PDF:', err);
      toast.error('No se pudo redimensionar el PDF', {
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
    link.download = `${selectedFile.name.replace(/\.pdf$/i, '')}_redimensionado.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const resetAll = () => {
    setSelectedFile(null);
    setTotalPages(0);
    setTarget('a4');
    setPercent('100');
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
                <Scaling className="mr-2 inline h-4 w-4" />
                Tamaño de destino
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => {
                      setTarget(opt.key);
                      setError('');
                    }}
                    aria-pressed={target === opt.key}
                    className={cn(
                      'rounded-lg border-3 border-ink px-3 py-3 text-sm font-bold transition-colors',
                      target === opt.key
                        ? accent.solid
                        : 'bg-surface text-ink hover:bg-muted'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {target === 'porcentaje' && (
                <div className="mt-4">
                  <Label
                    htmlFor="resize-percent"
                    className="mb-1.5 block text-sm font-normal text-muted-foreground"
                  >
                    Porcentaje de escala (1–500)
                  </Label>
                  <Input
                    id="resize-percent"
                    type="number"
                    min={1}
                    max={500}
                    step="any"
                    inputMode="decimal"
                    value={percent}
                    onChange={(e) => {
                      setPercent(e.target.value);
                      setError('');
                    }}
                  />
                </div>
              )}

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
                  {target === 'porcentaje'
                    ? 'Cada página (tamaño y contenido) se escala por el porcentaje indicado.'
                    : 'Cada página se recrea en el tamaño elegido; el contenido se centra y escala manteniendo la proporción.'}
                </p>
              </div>
            </div>

            <div className="mt-6 text-center">
              <Button
                onClick={resizePDF}
                disabled={isProcessing}
                aria-busy={isProcessing}
                size="lg"
                className={accent.solid}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Redimensionando…
                  </>
                ) : (
                  <>
                    <Scaling className="mr-2 h-5 w-5" />
                    Redimensionar PDF
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
              ¡PDF redimensionado!
            </h2>
            <p className="mb-6 text-ink">
              Se aplicó el tamaño de destino a todas las páginas.
            </p>
            <Button onClick={downloadResult} size="lg" className={accent.solid}>
              <Download className="mr-2 h-5 w-5" />
              Descargar PDF
            </Button>
            <div className="mt-6">
              <Button variant="outline" onClick={resetAll} size="lg">
                Redimensionar otro PDF
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </ToolShell>
  );
}
