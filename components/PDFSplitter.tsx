'use client';

import { useState, useRef, useEffect } from 'react';
import { PDFDocument } from 'pdf-lib';
import { FileText, Download, Loader2, X, Scissors, AlertCircle } from 'lucide-react';
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

const tool = getTool('dividir');
const accent = tool.accent;

interface SplitPDF {
  id: string;
  name: string;
  blob: Blob;
  pages: string;
}

export default function PDFSplitter() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [splitRanges, setSplitRanges] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [splitPDFs, setSplitPDFs] = useState<SplitPDF[]>([]);
  const [rangeError, setRangeError] = useState<string>('');
  const fileInfoRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  // Al seleccionar el archivo, baja a su información.
  useEffect(() => {
    if (selectedFile && fileInfoRef.current) {
      setTimeout(() => scrollIntoViewSafe(fileInfoRef.current), 100);
    }
  }, [selectedFile]);

  // Al completarse la división, baja al inicio de la sección de resultado.
  useEffect(() => {
    if (splitPDFs.length > 0) {
      setTimeout(() => scrollIntoViewSafe(resultRef.current), 100);
    }
  }, [splitPDFs.length]);

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
    setSplitPDFs([]);
    setSplitRanges('');
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

  const parseRanges = (rangeString: string): number[][] => {
    if (!rangeString.trim()) {
      throw new Error('Debes especificar al menos un rango o página.');
    }

    const ranges: number[][] = [];
    const parts = rangeString.split(',').map((part) => part.trim());

    for (const part of parts) {
      if (part.includes('-')) {
        // Range format: "1-3"
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

        ranges.push([start, end]);
      } else {
        // Single page format: "5"
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

        ranges.push([page, page]);
      }
    }

    return ranges;
  };

  const validateRanges = (rangeString: string): boolean => {
    try {
      parseRanges(rangeString);
      setRangeError('');
      return true;
    } catch (error) {
      setRangeError(error instanceof Error ? error.message : 'Error en el formato de rangos.');
      return false;
    }
  };

  const handleRangeChange = (value: string) => {
    setSplitRanges(value);
    if (value.trim() && totalPages > 0) {
      validateRanges(value);
    } else {
      setRangeError('');
    }
  };

  const splitPDF = async () => {
    if (!selectedFile || !validateRanges(splitRanges)) return;

    setIsProcessing(true);
    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const originalPdf = await PDFDocument.load(arrayBuffer);
      const ranges = parseRanges(splitRanges);
      const newSplitPDFs: SplitPDF[] = [];

      for (let i = 0; i < ranges.length; i++) {
        const [startPage, endPage] = ranges[i];
        const newPdf = await PDFDocument.create();

        // Copy pages (pdf-lib uses 0-based indexing)
        const pageIndices = [];
        for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
          pageIndices.push(pageNum - 1);
        }

        const copiedPages = await newPdf.copyPages(originalPdf, pageIndices);
        copiedPages.forEach((page) => newPdf.addPage(page));

        const pdfBytes = await newPdf.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });

        const pagesDescription =
          startPage === endPage
            ? `página ${startPage}`
            : `páginas ${startPage}-${endPage}`;

        newSplitPDFs.push({
          id: Math.random().toString(36).substring(2, 15),
          name: `${selectedFile.name.replace('.pdf', '')}_${pagesDescription}.pdf`,
          blob,
          pages: pagesDescription,
        });
      }

      setSplitPDFs(newSplitPDFs);
      toast.success(
        `Se ${newSplitPDFs.length === 1 ? 'creó' : 'crearon'} ${newSplitPDFs.length} archivo${newSplitPDFs.length !== 1 ? 's' : ''} PDF`
      );
    } catch (error) {
      console.error('Error splitting PDF:', error);
      toast.error('No se pudo dividir el PDF', {
        description: 'Inténtalo de nuevo.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadPDF = (splitPDF: SplitPDF) => {
    const url = URL.createObjectURL(splitPDF.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = splitPDF.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadAllPDFs = () => {
    splitPDFs.forEach((pdf) => {
      setTimeout(() => downloadPDF(pdf), 100);
    });
  };

  const resetAll = () => {
    setSelectedFile(null);
    setTotalPages(0);
    setSplitRanges('');
    setSplitPDFs([]);
    setRangeError('');
  };

  // Cambiar/descartar archivo con red de seguridad: ofrece deshacer.
  const changeFileWithUndo = () => {
    if (!selectedFile) return;
    const snap = { selectedFile, totalPages, splitRanges, splitPDFs };
    resetAll();
    toastUndo('Archivo descartado', {
      description: 'Selecciona otro PDF, o recupéralo si fue un error.',
      onUndo: () => {
        setSelectedFile(snap.selectedFile);
        setTotalPages(snap.totalPages);
        setSplitRanges(snap.splitRanges);
        setSplitPDFs(snap.splitPDFs);
      },
    });
  };

  const step: 1 | 2 | 3 = !selectedFile ? 1 : splitPDFs.length > 0 ? 3 : 2;

  return (
    <ToolShell tool={tool} step={step}>
      <FileDropzone
        className="mb-8"
        accent={accent}
        accept=".pdf,application/pdf"
        idleTitle="Selecciona un archivo PDF"
        idleSubtitle="Haz clic aquí o arrastra y suelta tu archivo PDF"
        dragTitle="Suelta el archivo PDF aquí"
        buttonLabel="Seleccionar archivo"
        ariaLabel="Seleccionar o arrastrar un archivo PDF"
        onFiles={(files) => handleFileSelect(files[0])}
      />

      {selectedFile && (
        <Card className="mb-8 motion-safe:animate-slide-up" ref={fileInfoRef}>
          <CardContent className="p-6">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-brand-navy">
                Archivo seleccionado
              </h2>
              <Button variant="outline" size="sm" onClick={changeFileWithUndo}>
                <X className="mr-2 h-4 w-4" />
                Cambiar archivo
              </Button>
            </div>

            <div className="flex items-center gap-4 rounded-lg bg-muted/50 p-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-brand-navy/[0.06]">
                <FileText className="h-6 w-6 text-brand-navy" />
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
                <Scissors className="mr-2 inline h-4 w-4" />
                Especifica las páginas o rangos a extraer
              </Label>
              <Input
                id="ranges"
                type="text"
                placeholder="Ej: 1-3, 5, 7-10"
                value={splitRanges}
                onChange={(e) => handleRangeChange(e.target.value)}
                aria-invalid={!!rangeError}
                aria-describedby="ranges-help"
                className={cn(
                  rangeError && 'border-brand-red/50 focus-visible:ring-brand-red/20'
                )}
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
              <div className={cn('mt-3 rounded-lg p-3', accent.soft)}>
                <p className={cn('text-sm font-medium', accent.softText)}>
                  Ejemplos:
                </p>
                <ul className={cn('mt-1 space-y-1 text-sm', accent.softText)}>
                  <li>• <code>1-3</code> — Páginas de la 1 a la 3</li>
                  <li>• <code>1, 3, 5</code> — Páginas individuales 1, 3 y 5</li>
                  <li>• <code>1-2, 5, 8-10</code> — Combina rangos y páginas</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedFile && splitRanges && !rangeError && splitPDFs.length === 0 && (
        <Card className="mb-8">
          <CardContent className="p-6 text-center">
            <h2 className="mb-4 font-display text-lg font-bold text-brand-navy">
              ¿Listo para dividir?
            </h2>
            <p className="mb-6 text-muted-foreground">
              Se crearán {parseRanges(splitRanges).length} archivos PDF según los
              rangos especificados.
            </p>
            <Button
              onClick={splitPDF}
              disabled={isProcessing}
              aria-busy={isProcessing}
              size="lg"
              className={accent.solid}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Dividiendo…
                </>
              ) : (
                <>
                  <Scissors className="mr-2 h-5 w-5" />
                  Dividir PDF
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {splitPDFs.length > 0 && (
        <Card
          ref={resultRef}
          className="border-success/20 bg-success/[0.06] motion-safe:animate-slide-up"
        >
          <CardContent className="p-6">
            <div className="mb-6 text-center">
              <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
                <Download className="h-8 w-8 text-success" />
              </div>
              <h2 className="mb-2 font-display text-lg font-bold text-success">
                ¡División completada!
              </h2>
              <p className="mb-4 text-success/90">
                Se han creado {splitPDFs.length} archivos PDF.
              </p>
              <Button onClick={downloadAllPDFs} size="lg" className={accent.solid}>
                <Download className="mr-2 h-5 w-5" />
                Descargar todo
              </Button>
            </div>

            <div className="space-y-3">
              <h3 className="mb-3 font-display font-bold text-ink">Archivos generados:</h3>
              {splitPDFs.map((pdf) => (
                <div
                  key={pdf.id}
                  className="flex items-center justify-between gap-3 rounded-lg border bg-card p-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-success/10">
                      <FileText className="h-5 w-5 text-success" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">
                        {pdf.name}
                      </p>
                      <p className="text-xs text-muted-foreground">{pdf.pages}</p>
                    </div>
                  </div>
                  <Button
                    onClick={() => downloadPDF(pdf)}
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Descargar
                  </Button>
                </div>
              ))}
            </div>

            <div className="mt-6 text-center">
              <Button variant="outline" onClick={resetAll} size="lg">
                Dividir otro PDF
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </ToolShell>
  );
}
