'use client';

import { useState, useRef, useEffect } from 'react';
import { PDFDocument } from 'pdf-lib';
import { FileText, Download, Loader2, X, FileOutput, AlertCircle } from 'lucide-react';
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

const tool = getTool('extraer-paginas');
const accent = tool.accent;

interface ResultPDF {
  name: string;
  blob: Blob;
  pageCount: number;
}

export default function PageExtractor() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [ranges, setRanges] = useState<string>('');
  const [rangeError, setRangeError] = useState<string>('');
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
    setRanges('');
    setRangeError('');

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

  /**
   * Convierte "1-3, 5, 8-10" en una lista PLANA de páginas (1-based), en el
   * orden indicado y conservando repeticiones (extraer = el usuario decide el
   * orden final de las páginas que conserva).
   */
  const parsePages = (rangeString: string): number[] => {
    if (!rangeString.trim()) {
      throw new Error('Debes especificar al menos un rango o página.');
    }

    const pages: number[] = [];
    const parts = rangeString.split(',').map((part) => part.trim());

    for (const part of parts) {
      if (part.includes('-')) {
        const [start, end] = part.split('-').map((num) => parseInt(num.trim()));

        if (isNaN(start) || isNaN(end)) {
          throw new Error(`Rango inválido: "${part}". Usa formato como "1-3".`);
        }
        if (start < 1 || end < 1) {
          throw new Error(`Las páginas deben ser números positivos. Error en: "${part}".`);
        }
        if (start > totalPages || end > totalPages) {
          throw new Error(`Las páginas no pueden ser mayores a ${totalPages}. Error en: "${part}".`);
        }
        if (start > end) {
          throw new Error(`El inicio del rango no puede ser mayor al final. Error en: "${part}".`);
        }

        for (let p = start; p <= end; p++) pages.push(p);
      } else {
        const page = parseInt(part);

        if (isNaN(page)) {
          throw new Error(`Página inválida: "${part}". Debe ser un número.`);
        }
        if (page < 1) {
          throw new Error(`Las páginas deben ser números positivos. Error en: "${part}".`);
        }
        if (page > totalPages) {
          throw new Error(`La página ${page} no existe. El PDF tiene ${totalPages} páginas.`);
        }

        pages.push(page);
      }
    }

    return pages;
  };

  const validatePages = (rangeString: string): boolean => {
    try {
      parsePages(rangeString);
      setRangeError('');
      return true;
    } catch (error) {
      setRangeError(error instanceof Error ? error.message : 'Error en el formato de rangos.');
      return false;
    }
  };

  const handleRangeChange = (value: string) => {
    setRanges(value);
    if (value.trim() && totalPages > 0) {
      validatePages(value);
    } else {
      setRangeError('');
    }
  };

  const pagesToKeep = (() => {
    if (!ranges.trim() || rangeError || totalPages === 0) return 0;
    try {
      return parsePages(ranges).length;
    } catch {
      return 0;
    }
  })();

  const extractPages = async () => {
    if (!selectedFile || !validatePages(ranges)) return;

    setIsProcessing(true);
    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const originalPdf = await PDFDocument.load(arrayBuffer);
      const pages = parsePages(ranges);

      const newPdf = await PDFDocument.create();
      // pdf-lib usa índices 0-based; copyPages respeta el orden del array.
      const copiedPages = await newPdf.copyPages(
        originalPdf,
        pages.map((p) => p - 1)
      );
      copiedPages.forEach((page) => newPdf.addPage(page));

      const pdfBytes = await newPdf.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });

      setResult({
        name: `${selectedFile.name.replace(/\.pdf$/i, '')}_extraido.pdf`,
        blob,
        pageCount: pages.length,
      });
      toast.success(
        `Se extrajo ${pages.length} página${pages.length !== 1 ? 's' : ''} en un PDF nuevo`
      );
    } catch (error) {
      console.error('Error extracting pages:', error);
      toast.error('No se pudieron extraer las páginas', {
        description: 'Inténtalo de nuevo.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadResult = () => {
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
    setRanges('');
    setRangeError('');
    setResult(null);
  };

  const changeFileWithUndo = () => {
    if (!selectedFile) return;
    const snap = { selectedFile, totalPages, ranges, result };
    resetAll();
    toastUndo('Archivo descartado', {
      description: 'Selecciona otro PDF, o recupéralo si fue un error.',
      onUndo: () => {
        setSelectedFile(snap.selectedFile);
        setTotalPages(snap.totalPages);
        setRanges(snap.ranges);
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
                <p className="truncate font-medium text-ink">
                  {selectedFile.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatFileSize(selectedFile.size)} • {totalPages} páginas
                </p>
              </div>
            </div>

            <div className="mt-6">
              <Label
                htmlFor="ranges"
                className="mb-2 block text-sm font-medium text-ink"
              >
                <FileOutput className="mr-2 inline h-4 w-4" />
                Especifica las páginas o rangos a conservar
              </Label>
              <Input
                id="ranges"
                type="text"
                placeholder="Ej: 1-3, 5, 8-10"
                value={ranges}
                onChange={(e) => handleRangeChange(e.target.value)}
                aria-invalid={!!rangeError}
                aria-describedby="ranges-help"
                className={cn(rangeError && 'border-brand-red focus-visible:ring-ink')}
              />
              {rangeError && (
                <div
                  className="mt-2 flex items-start gap-2 text-sm text-brand-red"
                  id="ranges-help"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>{rangeError}</span>
                </div>
              )}
              <div className={cn('mt-3 rounded-lg border-3 border-ink p-3', accent.soft)}>
                <p className={cn('text-sm font-bold', accent.softText)}>Ejemplos:</p>
                <ul className={cn('mt-1 space-y-1 text-sm', accent.softText)}>
                  <li>• <code>1-3</code> — Páginas de la 1 a la 3</li>
                  <li>• <code>1, 3, 5</code> — Páginas individuales 1, 3 y 5</li>
                  <li>• <code>8-10, 1, 5</code> — En el orden que indiques</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedFile && ranges && !rangeError && !result && (
        <Card className="mb-8">
          <CardContent className="p-4 text-center sm:p-6">
            <h2 className="mb-4 font-display text-lg font-bold text-ink">
              ¿Listo para extraer?
            </h2>
            <p className="mb-6 text-muted-foreground">
              Se conservarán {pagesToKeep} página{pagesToKeep !== 1 ? 's' : ''} en un
              único PDF nuevo, en el orden indicado.
            </p>
            <Button
              onClick={extractPages}
              disabled={isProcessing}
              aria-busy={isProcessing}
              size="lg"
              className={accent.solid}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Extrayendo…
                </>
              ) : (
                <>
                  <FileOutput className="mr-2 h-5 w-5" />
                  Extraer páginas
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
                ¡Páginas extraídas!
              </h2>
              <p className="mb-4 text-ink">
                Tu PDF nuevo contiene {result.pageCount} página
                {result.pageCount !== 1 ? 's' : ''}.
              </p>
              <Button onClick={downloadResult} size="lg" className={accent.solid}>
                <Download className="mr-2 h-5 w-5" />
                Descargar PDF
              </Button>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-lg border-3 border-ink bg-surface p-3 sm:p-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded border-2 border-ink bg-success text-white">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{result.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {result.pageCount} página{result.pageCount !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <Button
                onClick={downloadResult}
                size="sm"
                variant="outline"
                className="shrink-0"
                aria-label={`Descargar ${result.name}`}
              >
                <Download className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Descargar</span>
              </Button>
            </div>

            <div className="mt-6 text-center">
              <Button variant="outline" onClick={resetAll} size="lg">
                Extraer de otro PDF
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </ToolShell>
  );
}
