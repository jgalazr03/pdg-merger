'use client';

import { useState, useRef, useEffect } from 'react';
import { PDFDocument } from 'pdf-lib';
import { FileText, Download, Loader2, X, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn, scrollIntoViewSafe } from '@/lib/utils';
import { toastUndo } from '@/lib/toast';
import { getTool } from '@/lib/tools';
import ToolShell from '@/components/tools/ToolShell';
import FileDropzone from '@/components/tools/FileDropzone';
import ToolConstraints from '@/components/tools/ToolConstraints';

const tool = getTool('aplanar-pdf');
const accent = tool.accent;

export default function PDFFlattener() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fieldCount, setFieldCount] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [flattenedBlob, setFlattenedBlob] = useState<Blob | null>(null);
  const fileInfoRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedFile && fileInfoRef.current) {
      setTimeout(() => scrollIntoViewSafe(fileInfoRef.current), 100);
    }
  }, [selectedFile]);

  useEffect(() => {
    if (flattenedBlob) {
      setTimeout(() => scrollIntoViewSafe(resultRef.current), 100);
    }
  }, [flattenedBlob]);

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
    setFlattenedBlob(null);
    setFieldCount(0);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer);
      let count = 0;
      try {
        const form = pdf.getForm();
        count = form.getFields().length;
      } catch {
        // PDF sin formulario válido: lo tratamos como cero campos.
        count = 0;
      }
      setFieldCount(count);
    } catch (error) {
      console.error('Error loading PDF:', error);
      toast.error('No se pudo cargar el PDF', {
        description: 'Asegúrate de que sea un archivo válido.',
      });
      setSelectedFile(null);
      setFieldCount(0);
    }
  };

  const flattenPDF = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer);

      let flattened = 0;
      try {
        const form = pdf.getForm();
        flattened = form.getFields().length;
        if (flattened > 0) {
          form.flatten();
        }
      } catch {
        flattened = 0;
      }

      const pdfBytes = await pdf.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      setFlattenedBlob(blob);

      if (flattened > 0) {
        toast.success(
          `Se aplanaron ${flattened} campo${flattened !== 1 ? 's' : ''} de formulario`
        );
      } else {
        toast.success('PDF listo', {
          description: 'No había formularios que aplanar; el documento se guardó igual.',
        });
      }
    } catch (error) {
      console.error('Error flattening PDF:', error);
      toast.error('No se pudo aplanar el PDF', {
        description: 'Inténtalo de nuevo.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadPDF = () => {
    if (!flattenedBlob || !selectedFile) return;
    const url = URL.createObjectURL(flattenedBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selectedFile.name.replace(/\.pdf$/i, '')}_aplanado.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const resetAll = () => {
    setSelectedFile(null);
    setFieldCount(0);
    setFlattenedBlob(null);
  };

  const changeFileWithUndo = () => {
    if (!selectedFile) return;
    const snap = { selectedFile, fieldCount, flattenedBlob };
    resetAll();
    toastUndo('Archivo descartado', {
      description: 'Selecciona otro PDF, o recupéralo si fue un error.',
      onUndo: () => {
        setSelectedFile(snap.selectedFile);
        setFieldCount(snap.fieldCount);
        setFlattenedBlob(snap.flattenedBlob);
      },
    });
  };

  const step: 1 | 2 | 3 = !selectedFile ? 1 : flattenedBlob ? 3 : 2;

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

      {selectedFile && !flattenedBlob && (
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
                  {formatFileSize(selectedFile.size)}
                </p>
              </div>
            </div>

            <div
              className={cn(
                'mt-6 rounded-lg border-3 border-ink p-3',
                accent.soft
              )}
            >
              <p className={cn('text-sm font-bold', accent.softText)}>
                {fieldCount > 0
                  ? `Este PDF tiene ${fieldCount} campo${fieldCount !== 1 ? 's' : ''} de formulario.`
                  : 'Este PDF no tiene campos de formulario.'}
              </p>
              <p className={cn('mt-1 text-sm', accent.softText)}>
                {fieldCount > 0
                  ? 'Al aplanar, los valores quedan fijos como contenido y ya no podrán editarse.'
                  : 'Puedes guardarlo igualmente; el documento no cambiará.'}
              </p>
            </div>

            <div className="mt-6">
              <Button
                onClick={flattenPDF}
                disabled={isProcessing}
                aria-busy={isProcessing}
                size="lg"
                className={accent.solid}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Aplanando…
                  </>
                ) : (
                  <>
                    <Layers className="mr-2 h-5 w-5" />
                    Aplanar PDF
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {flattenedBlob && (
        <Card ref={resultRef} className="motion-safe:animate-slide-up">
          <CardContent className="p-4 sm:p-6">
            <div className="mb-6 text-center">
              <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full border-3 border-ink bg-success text-white">
                <Download className="h-8 w-8" />
              </div>
              <h2 className="mb-2 text-lg font-bold text-success">
                ¡PDF aplanado!
              </h2>
              <p className="mb-4 text-ink">Tu documento está listo para descargar.</p>
              <Button onClick={downloadPDF} size="lg" className={accent.solid}>
                <Download className="mr-2 h-5 w-5" />
                Descargar PDF
              </Button>
            </div>

            <div className="text-center">
              <Button variant="outline" onClick={resetAll} size="lg">
                Aplanar otro PDF
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </ToolShell>
  );
}
