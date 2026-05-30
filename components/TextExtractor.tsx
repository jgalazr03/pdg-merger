'use client';

import { useState, useRef, useEffect } from 'react';
import { Download, Loader2, X, FileText, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { cn, scrollIntoViewSafe } from '@/lib/utils';
import { toastUndo } from '@/lib/toast';
import { getTool } from '@/lib/tools';
import ToolShell from '@/components/tools/ToolShell';
import FileDropzone from '@/components/tools/FileDropzone';
import ToolConstraints from '@/components/tools/ToolConstraints';

// Carga perezosa y memoizada de pdfjs-dist; configura el worker una sola vez.
let pdfjsPromise: Promise<typeof import('pdfjs-dist')> | null = null;
const loadPdfjs = async () => {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist').then((mod) => {
      mod.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
      return mod;
    });
  }
  return pdfjsPromise;
};

const tool = getTool('extraer-texto');
const accent = tool.accent;

export default function TextExtractor() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [extractedText, setExtractedText] = useState<string | null>(null);
  const fileInfoRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  // Al seleccionar el archivo, baja a su información (como en las primeras herramientas).
  useEffect(() => {
    if (selectedFile) {
      setTimeout(() => scrollIntoViewSafe(fileInfoRef.current), 100);
    }
  }, [selectedFile]);

  useEffect(() => {
    if (extractedText !== null) {
      setTimeout(() => scrollIntoViewSafe(resultRef.current), 100);
    }
  }, [extractedText]);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleFileSelect = (file: File) => {
    if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) {
      toast.error('Archivo no válido', {
        description: 'Por favor selecciona un archivo PDF.',
      });
      return;
    }
    setSelectedFile(file);
    setExtractedText(null);
    setProgress(0);
  };

  const extractText = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setProgress(0);
    try {
      const pdfjsLib = await loadPdfjs();
      const arrayBuffer = await selectedFile.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      const parts: string[] = [];
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const content = await page.getTextContent();

        // Une los items respetando saltos: pdf.js marca el fin de línea con
        // hasEOL; cuando no, separa los fragmentos con un espacio.
        let pageText = '';
        for (const item of content.items as any[]) {
          if (typeof item.str !== 'string') continue;
          pageText += item.str;
          if (item.hasEOL) {
            pageText += '\n';
          } else if (item.str && !item.str.endsWith(' ')) {
            pageText += ' ';
          }
        }

        parts.push(
          `--- Página ${pageNum} ---\n\n${pageText.replace(/[ \t]+\n/g, '\n').trim()}`
        );
        setProgress(Math.round((pageNum / pdf.numPages) * 100));
      }

      const fullText = parts.join('\n\n');
      setExtractedText(fullText);

      const hasText = fullText.replace(/--- Página \d+ ---/g, '').trim().length > 0;
      if (hasText) {
        toast.success('Texto extraído', {
          description: `${pdf.numPages} página${pdf.numPages !== 1 ? 's' : ''} procesada${pdf.numPages !== 1 ? 's' : ''}.`,
        });
      } else {
        toast.success('Proceso completado', {
          description:
            'No se encontró texto seleccionable (el PDF podría ser una imagen escaneada).',
        });
      }
    } catch (error) {
      console.error('Error extracting text:', error);
      toast.error('No se pudo extraer el texto', {
        description: 'Asegúrate de que sea un PDF válido e inténtalo de nuevo.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadTxt = () => {
    if (extractedText === null) return;
    const blob = new Blob([extractedText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = selectedFile
      ? selectedFile.name.replace(/\.pdf$/i, '.txt')
      : 'texto.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const copyText = async () => {
    if (extractedText === null) return;
    try {
      await navigator.clipboard.writeText(extractedText);
      toast.success('Texto copiado al portapapeles');
    } catch {
      toast.error('No se pudo copiar', {
        description: 'Tu navegador bloqueó el acceso al portapapeles.',
      });
    }
  };

  const resetAll = () => {
    setSelectedFile(null);
    setExtractedText(null);
    setProgress(0);
  };

  const changeFileWithUndo = () => {
    if (!selectedFile) return;
    const snap = { selectedFile, extractedText };
    resetAll();
    toastUndo('Archivo descartado', {
      description: 'Selecciona otro PDF, o recupéralo si fue un error.',
      onUndo: () => {
        setSelectedFile(snap.selectedFile);
        setExtractedText(snap.extractedText);
      },
    });
  };

  const step: 1 | 2 | 3 = !selectedFile ? 1 : extractedText !== null ? 3 : 2;

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
        <Card ref={fileInfoRef} className="mb-8 motion-safe:animate-slide-up">
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
                  {formatFileSize(selectedFile.size)}
                </p>
              </div>
            </div>

            {isProcessing && (
              <div className="mt-6 space-y-2" aria-live="polite">
                <div className="flex items-center justify-between text-sm">
                  <span className={accent.text}>Extrayendo texto…</span>
                  <span className="text-muted-foreground">{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {selectedFile && extractedText === null && (
        <Card className="mb-8">
          <CardContent className="p-4 text-center sm:p-6">
            <h2 className="mb-4 font-display text-lg font-bold text-ink">
              ¿Listo para extraer?
            </h2>
            <p className="mb-6 text-muted-foreground">
              Se leerá el texto seleccionable de cada página del PDF.
            </p>
            <Button
              onClick={extractText}
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
                  <FileText className="mr-2 h-5 w-5" />
                  Extraer texto
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {extractedText !== null && (
        <Card ref={resultRef} className="motion-safe:animate-slide-up">
          <CardContent className="p-4 sm:p-6">
            <div className="mb-6 text-center">
              <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full border-3 border-ink bg-success text-white">
                <Download className="h-8 w-8" />
              </div>
              <h2 className="mb-2 text-lg font-bold text-success">
                ¡Texto extraído!
              </h2>
              <p className="mb-4 text-ink">
                Revisa la vista previa y descárgalo como archivo .txt.
              </p>
              <div className="flex flex-col justify-center gap-3 sm:flex-row">
                <Button onClick={downloadTxt} size="lg" className={accent.solid}>
                  <Download className="mr-2 h-5 w-5" />
                  Descargar .txt
                </Button>
                <Button variant="outline" onClick={copyText} size="lg">
                  <Copy className="mr-2 h-5 w-5" />
                  Copiar
                </Button>
              </div>
            </div>

            <Label
              htmlFor="extracted-preview"
              className="mb-2 block text-sm font-medium text-ink"
            >
              Vista previa
            </Label>
            <Textarea
              id="extracted-preview"
              readOnly
              value={extractedText}
              className="min-h-[280px] resize-y rounded-lg border-3 border-ink bg-surface px-3 py-2.5 font-mono text-base md:text-sm"
            />

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
