'use client';

import { useState, useRef } from 'react';
import { PDFDocument } from 'pdf-lib';
import { FileText, Download, Loader2, X, Scissors, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { toastUndo } from '@/lib/toast';
import { getTool } from '@/lib/tools';
import ToolShell from '@/components/tools/ToolShell';
import { useScrollOnAppear } from '@/components/tools/useScrollOnAppear';
import FileDropzone from '@/components/tools/FileDropzone';
import ToolConstraints from '@/components/tools/ToolConstraints';
import NextSteps from '@/components/tools/NextSteps';

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

  // Si ya había resultados y el usuario edita los rangos, ese resultado ya no
  // corresponde: se descarta y se avisa. No aplica al cargar/cambiar archivo
  // (eso pasa por `handleFileSelect`/`resetAll`, que ya limpian sin avisar).
  const handleRangeChange = (value: string) => {
    if (splitPDFs.length > 0) {
      setSplitPDFs([]);
      toast('Los rangos cambiaron', {
        description: 'Vuelve a dividir para incluir los cambios.',
      });
    }
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

  const totalSplitSize = splitPDFs.reduce((sum, pdf) => sum + pdf.blob.size, 0);

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

  // En móvil, bajar a la lista cuando aparece: el botón vive en la barra
  // inferior fija y, sin esto, la lista queda tapada por ella.
  const listRef = useRef<HTMLDivElement>(null);
  useScrollOnAppear(listRef, !!selectedFile);

  const step: 1 | 2 | 3 = !selectedFile ? 1 : splitPDFs.length > 0 ? 3 : 2;

  // ---- Derivados para el panel de acción -----------------------------------
  let rangeCount = 0;
  if (splitRanges.trim() && !rangeError) {
    try {
      rangeCount = parseRanges(splitRanges).length;
    } catch {
      rangeCount = 0;
    }
  }
  const ctaLabel = isProcessing ? 'Dividiendo…' : 'Dividir PDF';
  const ctaDisabled = isProcessing || !splitRanges.trim() || !!rangeError;
  const rangesPreview = !splitRanges.trim()
    ? 'Escribe qué páginas quieres'
    : !rangeError
      ? `Se crearán ${rangeCount} ${rangeCount === 1 ? 'documento' : 'documentos'}`
      : null;

  // Archivo a traspasar a "Continuar con…": solo tiene sentido cuando la
  // división produjo un único documento (con varios, no hay uno que elegir).
  const getResultFile = (): File | null =>
    splitPDFs.length === 1
      ? new File([splitPDFs[0].blob], splitPDFs[0].name, { type: 'application/pdf' })
      : null;

  // Panel de acción (lg+: columna derecha pegajosa; debajo: fluye tras el
  // contenido y deja el resumen y el botón a la barra inferior).
  const aside = !!selectedFile && (
    <div
      className={cn(
        'rounded-lg border-3 border-ink bg-card p-4 sm:p-5',
        // Sin resultado no hay opciones en el panel: bajo lg la barra inferior
        // basta y así no queda una tarjeta vacía tras el contenido.
        splitPDFs.length === 0 && 'hidden lg:block'
      )}
    >
      {splitPDFs.length > 0 ? (
        <>
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-success">
            Listo
          </p>
          <p className="mt-2 break-words text-base font-bold text-ink">
            {splitPDFs.length} {splitPDFs.length === 1 ? 'documento' : 'documentos'}
          </p>
          <p className="mt-1 text-sm tabular-nums text-muted-foreground">
            {formatFileSize(totalSplitSize)} en total
          </p>
          <div className="mt-4 hidden flex-col gap-2 lg:flex">
            <Button
              onClick={downloadAllPDFs}
              size="lg"
              className={cn('w-full', accent.solid)}
            >
              <Download className="mr-2 h-5 w-5" />
              Descargar todo
            </Button>
            <Button variant="outline" onClick={resetAll} size="lg" className="w-full">
              Dividir otro PDF
            </Button>
          </div>
          {splitPDFs.length === 1 && (
            <NextSteps
              tool={tool}
              getFile={getResultFile}
              className="mt-4 border-t-3 border-ink pt-4"
            />
          )}
        </>
      ) : (
        <>
          <div className="hidden lg:block">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">
              Resumen
            </p>
            <p
              className="mt-2 break-words text-sm font-bold text-ink"
              aria-live="polite"
            >
              {selectedFile.name}
            </p>
            <p className="text-sm tabular-nums text-muted-foreground">
              {formatFileSize(selectedFile.size)} · {totalPages}{' '}
              {totalPages === 1 ? 'página' : 'páginas'}
            </p>
            {rangesPreview && (
              <p className="mt-2 text-sm tabular-nums text-muted-foreground" aria-live="polite">
                {rangesPreview}
              </p>
            )}
          </div>

          <div className="mt-4 hidden lg:block">
            <Button
              onClick={splitPDF}
              disabled={ctaDisabled}
              aria-busy={isProcessing}
              size="lg"
              className={cn('w-full', accent.solid)}
            >
              {isProcessing ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <Scissors className="mr-2 h-5 w-5" />
              )}
              {ctaLabel}
            </Button>
          </div>
        </>
      )}
    </div>
  );

  // Barra inferior fija (solo por debajo de lg): resumen compacto + acción.
  const bar = !!selectedFile && (
    <div className="border-t-3 border-ink bg-surface pl-[max(20px,env(safe-area-inset-left))] pr-[max(20px,env(safe-area-inset-right))] pb-[max(12px,env(safe-area-inset-bottom))] pt-3">
      <div className="container mx-auto flex max-w-6xl items-center gap-3">
        <div className="min-w-0 flex-1">
          {splitPDFs.length > 0 ? (
            <>
              <p className="truncate text-sm font-bold tabular-nums text-ink">
                {splitPDFs.length} {splitPDFs.length === 1 ? 'documento' : 'documentos'}
              </p>
              <p className="truncate text-xs tabular-nums text-muted-foreground">
                {formatFileSize(totalSplitSize)} en total
              </p>
            </>
          ) : (
            <>
              <p className="truncate text-sm font-bold text-ink">
                {selectedFile.name}
              </p>
              <p className="truncate text-xs tabular-nums text-muted-foreground">
                {totalPages} {totalPages === 1 ? 'página' : 'páginas'}
                {rangeCount > 0
                  ? ` · ${rangeCount} ${rangeCount === 1 ? 'documento' : 'documentos'}`
                  : ''}
              </p>
            </>
          )}
        </div>
        {splitPDFs.length > 0 ? (
          <>
            <Button variant="outline" onClick={resetAll} className="shrink-0">
              Otro
            </Button>
            <Button onClick={downloadAllPDFs} className={cn('shrink-0', accent.solid)}>
              <Download className="mr-2 h-4 w-4" />
              Descargar
            </Button>
          </>
        ) : (
          <Button
            onClick={splitPDF}
            disabled={ctaDisabled}
            aria-busy={isProcessing}
            className={cn('shrink-0', accent.solid)}
          >
            {isProcessing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Scissors className="mr-2 h-4 w-4" />
            )}
            {isProcessing ? 'Dividiendo…' : 'Dividir'}
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <ToolShell tool={tool} step={step} aside={aside} bar={bar}>
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
        <Card ref={listRef} className="mb-8 motion-safe:animate-slide-up">
          <CardContent className="p-4 sm:p-6">
            {/* Encabezado + acción: apilados en móvil (el título mono envuelve
                y chocaba con el botón); en una fila a partir de sm. */}
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

            {/* Rangos: en el contenido, no en el panel, para que sigan editables
                cuando ya hay resultado (cambiarlos lo invalida con aviso). */}
            <div className="mt-6">
              <Label htmlFor="ranges" className="mb-2 block text-sm font-bold text-ink">
                Páginas o rangos a extraer
              </Label>
              <Input
                id="ranges"
                type="text"
                placeholder="Ej: 1-3, 5, 7-10"
                value={splitRanges}
                onChange={(e) => handleRangeChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !ctaDisabled) {
                    e.preventDefault();
                    void splitPDF();
                  }
                }}
                disabled={isProcessing}
                aria-invalid={!!rangeError}
                aria-describedby={rangeError ? 'ranges-help' : undefined}
                className={cn(
                  rangeError && 'border-brand-red focus-visible:ring-ink'
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
              <p className="mt-2 text-xs text-muted-foreground">
                Ejemplos: 1-3 · 1, 3, 5 · 1-2, 5, 8-10
              </p>
              {rangesPreview && (
                <p className="mt-2 text-sm tabular-nums text-muted-foreground lg:hidden">
                  {rangesPreview}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {splitPDFs.length > 1 && (
        <Card className="motion-safe:animate-slide-up">
          <CardContent className="p-4 sm:p-6">
            <h2 className="font-display text-lg font-bold text-ink">
              Archivos generados ({splitPDFs.length})
            </h2>
            <div className="mt-4 space-y-3">
              {splitPDFs.map((pdf) => (
                <div
                  key={pdf.id}
                  className="flex items-center justify-between gap-3 rounded-lg border-3 border-ink bg-surface p-3 sm:p-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded border-2 border-ink bg-success text-white">
                      <FileText className="h-5 w-5" />
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
                    aria-label={`Descargar ${pdf.name}`}
                  >
                    <Download className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Descargar</span>
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </ToolShell>
  );
}
