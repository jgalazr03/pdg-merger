'use client';

import { useState, useRef, useEffect } from 'react';
import { FileSpreadsheet, Download, Loader2, X, Scissors, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn, scrollIntoViewSafe } from '@/lib/utils';
import { getTool } from '@/lib/tools';
import {
  loadWorkbook,
  newWorkbook,
  copySheet,
  workbookToBlob,
  isXlsx,
  sheetFileName,
  EXCEL_ACCEPT,
} from '@/lib/excel-utils';
import ToolShell from '@/components/tools/ToolShell';
import FileDropzone from '@/components/tools/FileDropzone';
import ToolConstraints from '@/components/tools/ToolConstraints';

const tool = getTool('dividir-excel');
const accent = tool.accent;

export default function ExcelSplitter() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sheets, setSheets] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isReading, setIsReading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [resultName, setResultName] = useState('');
  const [resultCount, setResultCount] = useState(0);
  const infoRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (sheets.length && infoRef.current) {
      setTimeout(() => scrollIntoViewSafe(infoRef.current), 100);
    }
  }, [sheets.length]);
  useEffect(() => {
    if (resultBlob) setTimeout(() => scrollIntoViewSafe(resultRef.current), 100);
  }, [resultBlob]);

  const handleFile = async (file: File) => {
    if (!isXlsx(file)) {
      toast.error('Solo archivos .xlsx', {
        description: 'El formato .xls antiguo no es compatible.',
      });
      return;
    }
    setSelectedFile(file);
    setResultBlob(null);
    setSheets([]);
    setSelected(new Set());
    setIsReading(true);
    try {
      const wb = await loadWorkbook(file);
      const names = wb.worksheets.map((ws) => ws.name);
      setSheets(names);
      setSelected(new Set(names));
    } catch (err) {
      console.error('Error al leer Excel:', err);
      toast.error('No se pudo leer el archivo', {
        description: 'Revisa que sea un .xlsx válido.',
      });
      setSelectedFile(null);
    } finally {
      setIsReading(false);
    }
  };

  const toggle = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
    setResultBlob(null);
  };

  const split = async () => {
    if (!selectedFile || selected.size === 0) return;
    setIsProcessing(true);
    try {
      const wb = await loadWorkbook(selectedFile);
      const chosen = wb.worksheets.filter((ws) => selected.has(ws.name));
      const base = selectedFile.name.replace(/\.xlsx$/i, '');
      const out: { name: string; blob: Blob }[] = [];
      for (const ws of chosen) {
        const nw = await newWorkbook();
        copySheet(ws, nw, ws.name);
        out.push({
          name: `${base}-${sheetFileName(ws.name)}.xlsx`,
          blob: await workbookToBlob(nw),
        });
      }

      if (out.length === 1) {
        setResultBlob(out[0].blob);
        setResultName(out[0].name);
      } else {
        const JSZip = (await import('jszip')).default;
        const zip = new JSZip();
        out.forEach((f) => zip.file(f.name, f.blob));
        setResultBlob(await zip.generateAsync({ type: 'blob' }));
        setResultName(`${base}-hojas.zip`);
      }
      setResultCount(out.length);
      toast.success(`Se generaron ${out.length} archivo${out.length !== 1 ? 's' : ''}`);
    } catch (err) {
      console.error('Error al dividir Excel:', err);
      toast.error('No se pudo dividir el archivo', { description: 'Inténtalo de nuevo.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const download = () => {
    if (!resultBlob) return;
    const url = URL.createObjectURL(resultBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = resultName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setSelectedFile(null);
    setSheets([]);
    setSelected(new Set());
    setResultBlob(null);
    setResultCount(0);
  };

  const step: 1 | 2 | 3 = !selectedFile ? 1 : resultBlob ? 3 : 2;

  return (
    <ToolShell tool={tool} step={step}>
      <FileDropzone
        className="mb-4"
        accent={accent}
        loaded={step > 1}
        accept={EXCEL_ACCEPT}
        idleTitle="Selecciona un archivo Excel"
        idleSubtitle="Haz clic o arrastra un .xlsx para separar sus hojas"
        dragTitle="Suelta el archivo aquí"
        buttonLabel="Seleccionar archivo"
        ariaLabel="Seleccionar o arrastrar un archivo Excel"
        onFiles={(files) => handleFile(files[0])}
      />

      <ToolConstraints items={tool.constraints} />

      {isReading && (
        <div className="flex items-center gap-3 py-6 text-muted-foreground">
          <Loader2 className={cn('h-5 w-5 animate-spin', accent.text)} />
          Leyendo hojas…
        </div>
      )}

      {selectedFile && sheets.length > 0 && !resultBlob && (
        <Card className="mb-8 motion-safe:animate-slide-up" ref={infoRef}>
          <CardContent className="p-4 sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="font-display text-lg font-bold text-ink">
                {sheets.length} hoja{sheets.length !== 1 ? 's' : ''}
              </h2>
              <Button variant="outline" size="sm" onClick={reset} className="shrink-0">
                <X className="mr-2 h-4 w-4" />
                Cambiar archivo
              </Button>
            </div>

            <p className="mb-3 text-sm text-muted-foreground">
              Elige las hojas a extraer:
            </p>
            <ul className="space-y-2">
              {sheets.map((name, i) => {
                const on = selected.has(name);
                return (
                  <li key={`${name}-${i}`}>
                    <button
                      type="button"
                      onClick={() => toggle(name)}
                      aria-pressed={on}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-lg border-3 border-ink p-3 text-left transition-colors',
                        on ? accent.soft : 'bg-surface hover-fine:bg-muted'
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-6 w-6 shrink-0 items-center justify-center rounded border-2 border-ink',
                          on ? accent.solid : 'bg-surface'
                        )}
                      >
                        {on && <Check className="h-4 w-4" strokeWidth={3} />}
                      </span>
                      <FileSpreadsheet className={cn('h-5 w-5 shrink-0', accent.text)} />
                      <span className="min-w-0 flex-1 truncate font-medium text-ink">
                        {name}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="mt-6">
              <Button
                onClick={split}
                disabled={isProcessing || selected.size === 0}
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
                    Dividir {selected.size} hoja{selected.size !== 1 ? 's' : ''}
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
              <h2 className="mb-2 text-lg font-bold text-success">¡Listo!</h2>
              <p className="mb-4 text-ink">
                {resultCount === 1
                  ? 'Tu hoja está lista para descargar.'
                  : `${resultCount} hojas en un .zip, listas para descargar.`}
              </p>
              <Button onClick={download} size="lg" className={accent.solid}>
                <Download className="mr-2 h-5 w-5" />
                Descargar {resultCount === 1 ? 'Excel' : 'ZIP'}
              </Button>
            </div>
            <div className="text-center">
              <Button variant="outline" onClick={reset} size="lg">
                Dividir otro archivo
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </ToolShell>
  );
}
