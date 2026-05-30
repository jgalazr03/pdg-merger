'use client';

import { useState, useRef, useEffect } from 'react';
import { PDFDocument } from 'pdf-lib';
import { FileText, Download, Loader2, X, Shuffle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn, scrollIntoViewSafe } from '@/lib/utils';
import { toastUndo } from '@/lib/toast';
import { getTool } from '@/lib/tools';
import ToolShell from '@/components/tools/ToolShell';
import FileDropzone from '@/components/tools/FileDropzone';
import ToolConstraints from '@/components/tools/ToolConstraints';

const tool = getTool('unir-alternado');
const accent = tool.accent;

interface LoadedPDF {
  file: File;
  pageCount: number;
}

interface ResultPDF {
  name: string;
  blob: Blob;
  pageCount: number;
}

export default function AlternateMerger() {
  const [pdfA, setPdfA] = useState<LoadedPDF | null>(null);
  const [pdfB, setPdfB] = useState<LoadedPDF | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ResultPDF | null>(null);
  const optionsRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (pdfA && pdfB && optionsRef.current) {
      setTimeout(() => scrollIntoViewSafe(optionsRef.current), 100);
    }
  }, [pdfA, pdfB]);

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

  const isPdf = (file: File) =>
    file.type === 'application/pdf' || /\.pdf$/i.test(file.name);

  const loadPdf = async (file: File): Promise<LoadedPDF | null> => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer);
      return { file, pageCount: pdf.getPageCount() };
    } catch (error) {
      console.error('Error loading PDF:', error);
      toast.error('No se pudo cargar el PDF', {
        description: 'Asegúrate de que sea un archivo válido.',
      });
      return null;
    }
  };

  /**
   * Asigna los archivos seltos a A y B en orden. Acepta selección múltiple
   * (toma los dos primeros PDF) o selección de a uno por dropzone.
   */
  const handleFiles = async (files: FileList | File[], slot?: 'A' | 'B') => {
    const list = Array.from(files).filter(isPdf);
    if (list.length === 0) {
      toast.error('Archivo no válido', {
        description: 'Por favor selecciona archivos PDF.',
      });
      return;
    }

    setResult(null);

    if (slot === 'A') {
      const loaded = await loadPdf(list[0]);
      if (loaded) setPdfA(loaded);
      return;
    }
    if (slot === 'B') {
      const loaded = await loadPdf(list[0]);
      if (loaded) setPdfB(loaded);
      return;
    }

    // Selección múltiple desde una sola zona: rellena los huecos disponibles.
    for (const file of list) {
      // eslint-disable-next-line no-await-in-loop
      const loaded = await loadPdf(file);
      if (!loaded) continue;
      if (!pdfA) {
        setPdfA(loaded);
      } else if (!pdfB) {
        setPdfB(loaded);
      } else {
        break;
      }
    }
  };

  const removePdf = (slot: 'A' | 'B') => {
    if (slot === 'A') {
      const snap = pdfA;
      setPdfA(null);
      setResult(null);
      if (snap) {
        toastUndo('PDF A descartado', {
          description: 'Selecciona otro, o recupéralo si fue un error.',
          onUndo: () => setPdfA(snap),
        });
      }
    } else {
      const snap = pdfB;
      setPdfB(null);
      setResult(null);
      if (snap) {
        toastUndo('PDF B descartado', {
          description: 'Selecciona otro, o recupéralo si fue un error.',
          onUndo: () => setPdfB(snap),
        });
      }
    }
  };

  const mergeAlternate = async () => {
    if (!pdfA || !pdfB) return;

    setIsProcessing(true);
    try {
      const [bufferA, bufferB] = await Promise.all([
        pdfA.file.arrayBuffer(),
        pdfB.file.arrayBuffer(),
      ]);
      const docA = await PDFDocument.load(bufferA);
      const docB = await PDFDocument.load(bufferB);

      const newPdf = await PDFDocument.create();
      const countA = docA.getPageCount();
      const countB = docB.getPageCount();

      // Copia TODAS las páginas de cada documento de una vez (copyPages es la
      // operación cara) y luego intercala las referencias ya copiadas.
      const pagesA = await newPdf.copyPages(
        docA,
        Array.from({ length: countA }, (_, i) => i)
      );
      const pagesB = await newPdf.copyPages(
        docB,
        Array.from({ length: countB }, (_, i) => i)
      );

      const maxLen = Math.max(countA, countB);
      for (let i = 0; i < maxLen; i++) {
        if (i < countA) newPdf.addPage(pagesA[i]);
        if (i < countB) newPdf.addPage(pagesB[i]);
      }

      const pdfBytes = await newPdf.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });

      setResult({
        name: `${pdfA.file.name.replace(/\.pdf$/i, '')}_alternado.pdf`,
        blob,
        pageCount: countA + countB,
      });
      toast.success(
        `Se intercalaron ${countA + countB} páginas en un PDF nuevo`
      );
    } catch (error) {
      console.error('Error merging PDFs:', error);
      toast.error('No se pudieron unir los PDFs', {
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
    setPdfA(null);
    setPdfB(null);
    setResult(null);
  };

  const renderSlot = (slot: 'A' | 'B', loaded: LoadedPDF | null) => {
    if (loaded) {
      return (
        <div className="rounded-lg border-3 border-ink bg-surface p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <span
              className={cn(
                'inline-flex h-7 w-7 items-center justify-center rounded border-2 border-ink text-sm font-bold text-white',
                accent.iconBg
              )}
            >
              {slot}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => removePdf(slot)}
              className="shrink-0"
            >
              <X className="mr-2 h-4 w-4" />
              Quitar
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded border-2 border-ink bg-card">
              <FileText className="h-5 w-5 text-ink" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">
                {loaded.file.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(loaded.file.size)} • {loaded.pageCount} páginas
              </p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <FileDropzone
        accent={accent}
        accept=".pdf,application/pdf"
        idleTitle={`Documento ${slot}`}
        idleSubtitle={
          slot === 'A'
            ? 'El primer PDF a intercalar (sus páginas van primero)'
            : 'El segundo PDF a intercalar'
        }
        dragTitle={`Suelta el PDF ${slot} aquí`}
        buttonLabel={`Seleccionar PDF ${slot}`}
        ariaLabel={`Seleccionar o arrastrar el documento ${slot}`}
        onFiles={(files) => handleFiles(files, slot)}
      />
    );
  };

  const step: 1 | 2 | 3 = !pdfA || !pdfB ? 1 : result ? 3 : 2;

  return (
    <ToolShell tool={tool} step={step}>
      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        {renderSlot('A', pdfA)}
        {renderSlot('B', pdfB)}
      </div>

      <ToolConstraints items={tool.constraints} />

      {pdfA && pdfB && !result && (
        <Card className="mb-8 motion-safe:animate-slide-up" ref={optionsRef}>
          <CardContent className="p-4 text-center sm:p-6">
            <h2 className="mb-4 font-display text-lg font-bold text-ink">
              ¿Listo para intercalar?
            </h2>
            <p className="mb-2 text-muted-foreground">
              Se intercalarán las páginas: A1, B1, A2, B2…
            </p>
            <p className="mb-6 text-sm text-muted-foreground">
              Documento A: {pdfA.pageCount} páginas • Documento B: {pdfB.pageCount}{' '}
              páginas • Total: {pdfA.pageCount + pdfB.pageCount}
              {pdfA.pageCount !== pdfB.pageCount &&
                '. Las páginas sobrantes del más largo van al final.'}
            </p>
            <Button
              onClick={mergeAlternate}
              disabled={isProcessing}
              aria-busy={isProcessing}
              size="lg"
              className={accent.solid}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Intercalando…
                </>
              ) : (
                <>
                  <Shuffle className="mr-2 h-5 w-5" />
                  Unir alternando
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
                ¡PDFs intercalados!
              </h2>
              <p className="mb-4 text-ink">
                Tu PDF nuevo contiene {result.pageCount} páginas.
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
                Unir otros PDFs
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </ToolShell>
  );
}
