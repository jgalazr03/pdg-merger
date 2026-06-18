'use client';

import { useState, useRef, useEffect } from 'react';
import { FileSpreadsheet, Download, Loader2, X, Combine } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn, scrollIntoViewSafe } from '@/lib/utils';
import { getTool } from '@/lib/tools';
import {
  loadWorkbook,
  newWorkbook,
  copySheet,
  uniqueSheetName,
  workbookToBlob,
  isXlsx,
  EXCEL_ACCEPT,
} from '@/lib/excel-utils';
import ToolShell from '@/components/tools/ToolShell';
import FileDropzone from '@/components/tools/FileDropzone';
import ToolConstraints from '@/components/tools/ToolConstraints';

const tool = getTool('unir-excel');
const accent = tool.accent;

const MAX_FILES = 15;

export default function ExcelMerger() {
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [sheetCount, setSheetCount] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (files.length && listRef.current) {
      setTimeout(() => scrollIntoViewSafe(listRef.current), 100);
    }
  }, [files.length]);
  useEffect(() => {
    if (resultBlob) setTimeout(() => scrollIntoViewSafe(resultRef.current), 100);
  }, [resultBlob]);

  const formatSize = (b: number) =>
    b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1048576).toFixed(1)} MB`;

  const addFiles = (incoming: FileList) => {
    const next = [...files];
    let rejected = 0;
    Array.from(incoming).forEach((f) => {
      if (!isXlsx(f)) {
        rejected++;
        return;
      }
      if (next.some((e) => e.name === f.name && e.size === f.size)) return;
      next.push(f);
    });
    if (rejected) {
      toast.error('Solo archivos .xlsx', {
        description: 'El formato .xls antiguo no es compatible.',
      });
    }
    if (next.length > MAX_FILES) {
      toast.error(`Máximo ${MAX_FILES} archivos por unión`);
      next.length = MAX_FILES;
    }
    setFiles(next);
    setResultBlob(null);
  };

  const removeFile = (i: number) => {
    setFiles((prev) => prev.filter((_, idx) => idx !== i));
    setResultBlob(null);
  };

  const merge = async () => {
    if (files.length < 2) return;
    setIsProcessing(true);
    try {
      const out = await newWorkbook();
      let sheets = 0;
      // Secuencial: cargar varios libros a la vez puede agotar memoria en móvil.
      for (const file of files) {
        const wb = await loadWorkbook(file);
        for (const ws of wb.worksheets) {
          copySheet(ws, out, uniqueSheetName(out, ws.name));
          sheets++;
        }
      }
      const blob = await workbookToBlob(out);
      setSheetCount(sheets);
      setResultBlob(blob);
      toast.success(`Se unieron ${files.length} archivos en uno`);
    } catch (err) {
      console.error('Error al unir Excel:', err);
      toast.error('No se pudieron unir los archivos', {
        description: 'Revisa que todos sean .xlsx válidos.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const download = () => {
    if (!resultBlob) return;
    const url = URL.createObjectURL(resultBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'libros-unidos.xlsx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setFiles([]);
    setResultBlob(null);
    setSheetCount(0);
  };

  const step: 1 | 2 | 3 = files.length === 0 ? 1 : resultBlob ? 3 : 2;

  return (
    <ToolShell tool={tool} step={step}>
      <FileDropzone
        className="mb-4"
        accent={accent}
        loaded={step > 1}
        accept={EXCEL_ACCEPT}
        multiple
        idleTitle="Selecciona archivos Excel"
        idleSubtitle="Haz clic o arrastra varios archivos .xlsx para combinarlos"
        dragTitle="Suelta los archivos aquí"
        buttonLabel="Seleccionar archivos"
        ariaLabel="Seleccionar o arrastrar archivos Excel"
        onFiles={addFiles}
      />

      <ToolConstraints items={tool.constraints} />

      {files.length > 0 && !resultBlob && (
        <Card className="mb-8 motion-safe:animate-slide-up" ref={listRef}>
          <CardContent className="p-4 sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="font-display text-lg font-bold text-ink">
                {files.length} archivo{files.length !== 1 ? 's' : ''}
              </h2>
              <Button variant="outline" size="sm" onClick={reset} className="shrink-0">
                <X className="mr-2 h-4 w-4" />
                Quitar todos
              </Button>
            </div>

            <ul className="space-y-2">
              {files.map((f, i) => (
                <li
                  key={`${f.name}-${i}`}
                  className="flex items-center gap-3 rounded-lg border-3 border-ink bg-surface p-3"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded border-2 border-ink bg-card">
                    <FileSpreadsheet className={cn('h-5 w-5', accent.text)} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ink">{f.name}</p>
                    <p className="text-sm text-muted-foreground">{formatSize(f.size)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    aria-label={`Quitar ${f.name}`}
                    className="rounded p-1.5 text-muted-foreground transition-colors hover-fine:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>

            {files.length < 2 && (
              <p className="mt-4 text-sm text-muted-foreground">
                Agrega al menos 2 archivos para unirlos.
              </p>
            )}

            <div className="mt-6">
              <Button
                onClick={merge}
                disabled={isProcessing || files.length < 2}
                aria-busy={isProcessing}
                size="lg"
                className={accent.solid}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Uniendo…
                  </>
                ) : (
                  <>
                    <Combine className="mr-2 h-5 w-5" />
                    Unir Excel
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {resultBlob && (
        <Card ref={resultRef} className="motion-safe:animate-slide-up">
          <CardContent className="p-4 sm:p-6">
            <div className="mb-6 text-center">
              <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full border-3 border-ink bg-success text-white">
                <Download className="h-8 w-8" />
              </div>
              <h2 className="mb-2 text-lg font-bold text-success">¡Archivos unidos!</h2>
              <p className="mb-4 text-ink">
                {sheetCount} hoja{sheetCount !== 1 ? 's' : ''} en un solo libro.
              </p>
              <Button onClick={download} size="lg" className={accent.solid}>
                <Download className="mr-2 h-5 w-5" />
                Descargar Excel
              </Button>
            </div>
            <div className="text-center">
              <Button variant="outline" onClick={reset} size="lg">
                Unir otros archivos
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </ToolShell>
  );
}
