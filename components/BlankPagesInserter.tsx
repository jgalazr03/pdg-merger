'use client';

import { useState, useRef, useEffect } from 'react';
import { PDFDocument } from 'pdf-lib';
import { FileText, Download, Loader2, X, FilePlus, AlertCircle } from 'lucide-react';
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

const tool = getTool('paginas-en-blanco');
const accent = tool.accent;

type Placement = 'after' | 'before';

interface ResultPDF {
  name: string;
  blob: Blob;
  pageCount: number;
  inserted: number;
}

export default function BlankPagesInserter() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [positions, setPositions] = useState<string>('');
  const [placement, setPlacement] = useState<Placement>('after');
  const [posError, setPosError] = useState<string>('');
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
    setPositions('');
    setPosError('');

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
   * Convierte "1, 3, 5" en una lista ordenada y deduplicada de posiciones
   * (1-based), validando contra el número de páginas del documento.
   */
  const parsePositions = (value: string): number[] => {
    if (!value.trim()) {
      throw new Error('Debes indicar al menos una posición.');
    }

    const seen = new Set<number>();
    const parts = value.split(',').map((p) => p.trim());

    for (const part of parts) {
      const n = parseInt(part);
      if (isNaN(n)) {
        throw new Error(`Posición inválida: "${part}". Debe ser un número.`);
      }
      if (n < 1) {
        throw new Error(`Las posiciones deben ser números positivos. Error en: "${part}".`);
      }
      if (n > totalPages) {
        throw new Error(`La página ${n} no existe. El PDF tiene ${totalPages} páginas.`);
      }
      seen.add(n);
    }

    return Array.from(seen).sort((a, b) => a - b);
  };

  const validatePositions = (value: string): boolean => {
    try {
      parsePositions(value);
      setPosError('');
      return true;
    } catch (error) {
      setPosError(error instanceof Error ? error.message : 'Error en el formato.');
      return false;
    }
  };

  const handlePositionsChange = (value: string) => {
    setPositions(value);
    if (value.trim() && totalPages > 0) {
      validatePositions(value);
    } else {
      setPosError('');
    }
  };

  const insertCount = (() => {
    if (!positions.trim() || posError || totalPages === 0) return 0;
    try {
      return parsePositions(positions).length;
    } catch {
      return 0;
    }
  })();

  const insertBlankPages = async () => {
    if (!selectedFile || !validatePositions(positions)) return;

    setIsProcessing(true);
    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer);
      const refPositions = parsePositions(positions);

      // El índice de inserción (0-based) se desplaza con cada página añadida.
      // Procesamos en orden ascendente y compensamos con `offset`.
      let offset = 0;
      for (const pos of refPositions) {
        // Página vecina de la que se hereda el tamaño:
        // - "después": la propia página `pos` (1-based → índice pos-1).
        // - "antes": misma página `pos`; la nueva se coloca antes de ella.
        const neighborIndex = pos - 1; // posición ORIGINAL de la vecina
        const neighbor = pdf.getPage(neighborIndex + offset);
        const { width, height } = neighbor.getSize();

        // Índice donde insertar la nueva página, ya con el desplazamiento.
        const insertIndex =
          placement === 'after'
            ? neighborIndex + offset + 1
            : neighborIndex + offset;

        pdf.insertPage(insertIndex, [width, height]);
        offset += 1;
      }

      const pdfBytes = await pdf.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });

      setResult({
        name: `${selectedFile.name.replace(/\.pdf$/i, '')}_con-blancos.pdf`,
        blob,
        pageCount: pdf.getPageCount(),
        inserted: refPositions.length,
      });
      toast.success(
        `Se ${refPositions.length === 1 ? 'insertó' : 'insertaron'} ${refPositions.length} página${refPositions.length !== 1 ? 's' : ''} en blanco`
      );
    } catch (error) {
      console.error('Error inserting blank pages:', error);
      toast.error('No se pudieron insertar las páginas', {
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
    setPositions('');
    setPosError('');
    setPlacement('after');
    setResult(null);
  };

  const changeFileWithUndo = () => {
    if (!selectedFile) return;
    const snap = { selectedFile, totalPages, positions, placement, result };
    resetAll();
    toastUndo('Archivo descartado', {
      description: 'Selecciona otro PDF, o recupéralo si fue un error.',
      onUndo: () => {
        setSelectedFile(snap.selectedFile);
        setTotalPages(snap.totalPages);
        setPositions(snap.positions);
        setPlacement(snap.placement);
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

            <div className="mt-6">
              <span className="mb-2 block text-sm font-bold text-ink">
                ¿Dónde insertar la página en blanco?
              </span>
              <div className="grid grid-cols-2 gap-3" role="group" aria-label="Posición de la página en blanco">
                <button
                  type="button"
                  onClick={() => setPlacement('after')}
                  aria-pressed={placement === 'after'}
                  className={cn(
                    'rounded-lg border-3 border-ink px-4 py-3 text-sm font-bold transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2',
                    placement === 'after'
                      ? cn(accent.solid)
                      : 'bg-surface text-ink hover:bg-muted'
                  )}
                >
                  Después de la página
                </button>
                <button
                  type="button"
                  onClick={() => setPlacement('before')}
                  aria-pressed={placement === 'before'}
                  className={cn(
                    'rounded-lg border-3 border-ink px-4 py-3 text-sm font-bold transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2',
                    placement === 'before'
                      ? cn(accent.solid)
                      : 'bg-surface text-ink hover:bg-muted'
                  )}
                >
                  Antes de la página
                </button>
              </div>
            </div>

            <div className="mt-6">
              <Label
                htmlFor="positions"
                className="mb-2 block text-sm font-medium text-ink"
              >
                <FilePlus className="mr-2 inline h-4 w-4" />
                Posiciones (números de página)
              </Label>
              <Input
                id="positions"
                type="text"
                placeholder="Ej: 1, 3, 5"
                value={positions}
                onChange={(e) => handlePositionsChange(e.target.value)}
                aria-invalid={!!posError}
                aria-describedby="positions-help"
                className={cn(posError && 'border-brand-red focus-visible:ring-ink')}
              />
              {posError && (
                <div
                  className="mt-2 flex items-start gap-2 text-sm text-brand-red"
                  id="positions-help"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>{posError}</span>
                </div>
              )}
              <div className={cn('mt-3 rounded-lg border-3 border-ink p-3', accent.soft)}>
                <p className={cn('text-sm', accent.softText)}>
                  Se insertará una página en blanco{' '}
                  <strong>{placement === 'after' ? 'después' : 'antes'}</strong> de cada
                  página que indiques. Cada página nueva toma el tamaño de su vecina.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedFile && positions && !posError && !result && (
        <Card className="mb-8">
          <CardContent className="p-4 text-center sm:p-6">
            <h2 className="mb-4 font-display text-lg font-bold text-ink">
              ¿Listo para insertar?
            </h2>
            <p className="mb-6 text-muted-foreground">
              Se insertará{insertCount !== 1 ? 'n' : ''} {insertCount} página
              {insertCount !== 1 ? 's' : ''} en blanco{' '}
              {placement === 'after' ? 'después' : 'antes'} de las posiciones indicadas.
            </p>
            <Button
              onClick={insertBlankPages}
              disabled={isProcessing}
              aria-busy={isProcessing}
              size="lg"
              className={accent.solid}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Insertando…
                </>
              ) : (
                <>
                  <FilePlus className="mr-2 h-5 w-5" />
                  Insertar páginas en blanco
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
                ¡Páginas insertadas!
              </h2>
              <p className="mb-4 text-ink">
                Se {result.inserted === 1 ? 'añadió' : 'añadieron'} {result.inserted}{' '}
                página{result.inserted !== 1 ? 's' : ''} en blanco. Tu PDF ahora tiene{' '}
                {result.pageCount} páginas.
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
                    {result.pageCount} páginas
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
                Procesar otro PDF
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </ToolShell>
  );
}
