'use client';

import { useState, useRef, useEffect } from 'react';
import { FileText, Download, Loader2, X, ScanText, FileType } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn, scrollIntoViewSafe } from '@/lib/utils';
import { getTool } from '@/lib/tools';
import { ocrFile, type OcrResult } from '@/lib/ocr';
import ToolShell from '@/components/tools/ToolShell';
import FileDropzone from '@/components/tools/FileDropzone';
import ToolConstraints from '@/components/tools/ToolConstraints';

const tool = getTool('ocr');
const accent = tool.accent;

const accepts = (f: File) =>
  f.type === 'application/pdf' ||
  /\.pdf$/i.test(f.name) ||
  f.type.startsWith('image/') ||
  /\.(png|jpe?g|webp|bmp|gif|tiff?)$/i.test(f.name);

export default function OcrTool() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<OcrResult | null>(null);
  const infoRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedFile) setTimeout(() => scrollIntoViewSafe(infoRef.current), 100);
  }, [selectedFile]);
  useEffect(() => {
    if (result) setTimeout(() => scrollIntoViewSafe(resultRef.current), 100);
  }, [result]);

  const formatSize = (b: number) =>
    b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`;

  const handleFile = (file: File) => {
    if (!accepts(file)) {
      toast.error('Archivo no válido', {
        description: 'Sube un PDF escaneado o una imagen (JPG, PNG…).',
      });
      return;
    }
    setSelectedFile(file);
    setResult(null);
    setProgress(0);
  };

  const run = async () => {
    if (!selectedFile) return;
    setIsProcessing(true);
    setProgress(0);
    try {
      const res = await ocrFile(selectedFile, (pct) => setProgress(pct));
      if (!res.text.trim()) {
        toast.warning('No se detectó texto', {
          description: 'El documento puede estar muy borroso o no contener texto.',
        });
      } else {
        toast.success('Texto reconocido');
      }
      setResult(res);
    } catch (err) {
      console.error('Error en OCR:', err);
      toast.error('No se pudo procesar', {
        description: 'Inténtalo de nuevo con un archivo más nítido.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const baseName = () =>
    (selectedFile?.name ?? 'documento').replace(/\.[^.]+$/, '');

  const download = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadPdf = () => {
    if (result) download(result.pdfBlob, `${baseName()}_buscable.pdf`);
  };
  const downloadTxt = () => {
    if (!result) return;
    download(
      new Blob([result.text], { type: 'text/plain;charset=utf-8' }),
      `${baseName()}.txt`
    );
  };

  const reset = () => {
    setSelectedFile(null);
    setResult(null);
    setProgress(0);
  };

  const step: 1 | 2 | 3 = !selectedFile ? 1 : result ? 3 : 2;

  return (
    <ToolShell tool={tool} step={step}>
      <FileDropzone
        className="mb-4"
        accent={accent}
        loaded={step > 1}
        accept=".pdf,image/*"
        idleTitle="Selecciona un PDF o imagen"
        idleSubtitle="Haz clic o arrastra un PDF escaneado o una imagen (JPG, PNG)"
        dragTitle="Suelta el archivo aquí"
        buttonLabel="Seleccionar archivo"
        ariaLabel="Seleccionar o arrastrar un PDF o imagen"
        onFiles={(files) => handleFile(files[0])}
      />

      <ToolConstraints items={tool.constraints} />

      {selectedFile && !result && (
        <Card ref={infoRef} className="mb-8 motion-safe:animate-slide-up">
          <CardContent className="p-4 sm:p-6">
            <div className="mb-6 flex items-center justify-between gap-3">
              <h2 className="font-display text-lg font-bold text-ink">
                Archivo seleccionado
              </h2>
              <Button
                variant="outline"
                size="sm"
                onClick={reset}
                className="shrink-0"
                disabled={isProcessing}
              >
                <X className="mr-2 h-4 w-4" />
                Cambiar
              </Button>
            </div>

            <div className="flex items-center gap-4 rounded-lg border-3 border-ink bg-surface p-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded border-2 border-ink bg-card">
                <FileText className="h-6 w-6 text-ink" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink">{selectedFile.name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatSize(selectedFile.size)}
                </p>
              </div>
            </div>

            <div className={cn('mt-6 rounded-lg border-3 border-ink p-3', accent.soft)}>
              <p className={cn('text-sm', accent.softText)}>
                La primera vez se descarga el modelo de español (~2 MB) y queda
                guardado en tu navegador para después. El OCR puede tardar unos
                segundos por página.
              </p>
            </div>

            {isProcessing && (
              <div className="mt-6 space-y-2" aria-live="polite">
                <div className="flex items-center justify-between text-sm">
                  <span className={accent.text}>Reconociendo texto…</span>
                  <span className="tabular-nums text-muted-foreground">{progress}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full border-2 border-ink bg-surface">
                  <div
                    className={cn('h-full transition-[width] duration-200 ease-out', accent.line)}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            <div className="mt-6">
              <Button
                onClick={run}
                disabled={isProcessing}
                aria-busy={isProcessing}
                size="lg"
                className={accent.solid}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Reconociendo…
                  </>
                ) : (
                  <>
                    <ScanText className="mr-2 h-5 w-5" />
                    Reconocer texto
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card ref={resultRef} className="motion-safe:animate-slide-up">
          <CardContent className="p-4 sm:p-6">
            <div className="mb-6 text-center">
              <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full border-3 border-ink bg-success text-white">
                <ScanText className="h-8 w-8" />
              </div>
              <h2 className="mb-2 text-lg font-bold text-success">
                ¡Texto reconocido!
              </h2>
              <p className="mb-4 text-ink">
                {result.pages} página{result.pages !== 1 ? 's' : ''} procesada
                {result.pages !== 1 ? 's' : ''}. Descarga el PDF buscable o el
                texto.
              </p>
              <div className="flex flex-col justify-center gap-3 sm:flex-row">
                <Button onClick={downloadPdf} size="lg" className={accent.solid}>
                  <Download className="mr-2 h-5 w-5" />
                  PDF buscable
                </Button>
                <Button onClick={downloadTxt} variant="outline" size="lg">
                  <FileType className="mr-2 h-5 w-5" />
                  Texto (.txt)
                </Button>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="mb-2 font-display font-bold text-ink">
                Vista previa del texto
              </h3>
              <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg border-3 border-ink bg-surface p-3 text-sm text-ink">
                {result.text.trim() || 'No se detectó texto en el documento.'}
              </pre>
            </div>

            <div className="text-center">
              <Button variant="outline" onClick={reset} size="lg">
                Procesar otro archivo
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </ToolShell>
  );
}
