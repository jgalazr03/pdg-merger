'use client';

import { useState, useRef, useEffect } from 'react';
import { PDFDocument } from 'pdf-lib';
import { FileText, Download, Loader2, X, Eraser, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn, scrollIntoViewSafe } from '@/lib/utils';
import { toastUndo } from '@/lib/toast';
import { getTool } from '@/lib/tools';
import ToolShell from '@/components/tools/ToolShell';
import FileDropzone from '@/components/tools/FileDropzone';
import ToolConstraints from '@/components/tools/ToolConstraints';

const tool = getTool('limpiar-metadatos');
const accent = tool.accent;

interface CurrentMeta {
  title: string;
  author: string;
  subject: string;
  keywords: string;
  creator: string;
  producer: string;
  creationDate: string;
  modificationDate: string;
}

const EMPTY_META: CurrentMeta = {
  title: '',
  author: '',
  subject: '',
  keywords: '',
  creator: '',
  producer: '',
  creationDate: '',
  modificationDate: '',
};

export default function MetadataCleaner() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [meta, setMeta] = useState<CurrentMeta>(EMPTY_META);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cleanedBlob, setCleanedBlob] = useState<Blob | null>(null);
  const fileInfoRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedFile && fileInfoRef.current) {
      setTimeout(() => scrollIntoViewSafe(fileInfoRef.current), 100);
    }
  }, [selectedFile]);

  useEffect(() => {
    if (cleanedBlob) {
      setTimeout(() => scrollIntoViewSafe(resultRef.current), 100);
    }
  }, [cleanedBlob]);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (d: Date | undefined): string => {
    if (!d) return '';
    try {
      return d.toLocaleString('es-MX', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return d.toISOString();
    }
  };

  const handleFileSelect = async (file: File) => {
    if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) {
      toast.error('Archivo no válido', {
        description: 'Por favor selecciona un archivo PDF.',
      });
      return;
    }

    setSelectedFile(file);
    setCleanedBlob(null);
    setMeta(EMPTY_META);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer, { updateMetadata: false });

      let creationDate = '';
      let modificationDate = '';
      try {
        creationDate = formatDate(pdf.getCreationDate());
      } catch {
        /* fecha inválida en el PDF: la ignoramos */
      }
      try {
        modificationDate = formatDate(pdf.getModificationDate());
      } catch {
        /* fecha inválida en el PDF: la ignoramos */
      }

      setMeta({
        title: pdf.getTitle() ?? '',
        author: pdf.getAuthor() ?? '',
        subject: pdf.getSubject() ?? '',
        keywords: pdf.getKeywords() ?? '',
        creator: pdf.getCreator() ?? '',
        producer: pdf.getProducer() ?? '',
        creationDate,
        modificationDate,
      });
    } catch (error) {
      console.error('Error loading PDF:', error);
      toast.error('No se pudo cargar el PDF', {
        description: 'Asegúrate de que sea un archivo válido.',
      });
      setSelectedFile(null);
      setMeta(EMPTY_META);
    }
  };

  const cleanMetadata = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer, { updateMetadata: false });

      pdf.setTitle('');
      pdf.setAuthor('');
      pdf.setSubject('');
      pdf.setKeywords([]);
      pdf.setCreator('');
      pdf.setProducer('');

      // Fecha fija neutra para no dejar rastro temporal del momento de saneo.
      const fixedDate = new Date(0);
      pdf.setCreationDate(fixedDate);
      pdf.setModificationDate(fixedDate);

      const pdfBytes = await pdf.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      setCleanedBlob(blob);
      toast.success('Metadatos eliminados');
    } catch (error) {
      console.error('Error cleaning metadata:', error);
      toast.error('No se pudieron quitar los metadatos', {
        description: 'Inténtalo de nuevo.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadPDF = () => {
    if (!cleanedBlob || !selectedFile) return;
    const url = URL.createObjectURL(cleanedBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selectedFile.name.replace(/\.pdf$/i, '')}_sin_metadatos.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const resetAll = () => {
    setSelectedFile(null);
    setMeta(EMPTY_META);
    setCleanedBlob(null);
  };

  const changeFileWithUndo = () => {
    if (!selectedFile) return;
    const snap = { selectedFile, meta, cleanedBlob };
    resetAll();
    toastUndo('Archivo descartado', {
      description: 'Selecciona otro PDF, o recupéralo si fue un error.',
      onUndo: () => {
        setSelectedFile(snap.selectedFile);
        setMeta(snap.meta);
        setCleanedBlob(snap.cleanedBlob);
      },
    });
  };

  const step: 1 | 2 | 3 = !selectedFile ? 1 : cleanedBlob ? 3 : 2;

  const rows: { label: string; value: string }[] = [
    { label: 'Título', value: meta.title },
    { label: 'Autor', value: meta.author },
    { label: 'Asunto', value: meta.subject },
    { label: 'Palabras clave', value: meta.keywords },
    { label: 'Creador', value: meta.creator },
    { label: 'Productor', value: meta.producer },
    { label: 'Fecha de creación', value: meta.creationDate },
    { label: 'Fecha de modificación', value: meta.modificationDate },
  ];

  const hasAnyMeta = rows.some((r) => r.value.trim().length > 0);

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

      {selectedFile && !cleanedBlob && (
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
                'mt-6 flex items-start gap-2 rounded-lg border-3 border-ink p-3',
                accent.soft
              )}
            >
              <ShieldCheck
                className={cn('mt-0.5 h-5 w-5 shrink-0', accent.softText)}
              />
              <p className={cn('text-sm', accent.softText)}>
                Los PDF guardan datos ocultos (autor, software, fechas) que pueden
                revelar quién y cómo creó el documento. Quitarlos protege tu
                privacidad antes de compartirlo.
              </p>
            </div>

            <div className="mt-6">
              <h3 className="mb-3 font-display font-bold text-ink">
                Metadatos actuales
              </h3>
              {hasAnyMeta ? (
                <div className="overflow-hidden rounded-lg border-3 border-ink">
                  {rows
                    .filter((r) => r.value.trim().length > 0)
                    .map((r, i) => (
                      <div
                        key={r.label}
                        className={cn(
                          'flex flex-col gap-0.5 p-3 sm:flex-row sm:gap-4',
                          i > 0 && 'border-t-3 border-ink'
                        )}
                      >
                        <span className="shrink-0 text-sm font-bold text-ink sm:w-44">
                          {r.label}
                        </span>
                        <span className="min-w-0 break-words text-sm text-muted-foreground">
                          {r.value}
                        </span>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="rounded-lg border-3 border-ink bg-surface p-3 text-sm text-muted-foreground">
                  Este PDF no declara metadatos de texto. Aun así puedes sanear las
                  fechas y el productor.
                </p>
              )}
            </div>

            <div className="mt-6">
              <Button
                onClick={cleanMetadata}
                disabled={isProcessing}
                aria-busy={isProcessing}
                size="lg"
                className={accent.solid}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Quitando…
                  </>
                ) : (
                  <>
                    <Eraser className="mr-2 h-5 w-5" />
                    Quitar metadatos
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {cleanedBlob && (
        <Card ref={resultRef} className="motion-safe:animate-slide-up">
          <CardContent className="p-4 sm:p-6">
            <div className="mb-6 text-center">
              <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full border-3 border-ink bg-success text-white">
                <ShieldCheck className="h-8 w-8" />
              </div>
              <h2 className="mb-2 text-lg font-bold text-success">
                ¡PDF saneado!
              </h2>
              <p className="mb-4 text-ink">
                Se eliminaron los metadatos. Tu documento está listo.
              </p>
              <Button onClick={downloadPDF} size="lg" className={accent.solid}>
                <Download className="mr-2 h-5 w-5" />
                Descargar PDF
              </Button>
            </div>

            <div className="text-center">
              <Button variant="outline" onClick={resetAll} size="lg">
                Limpiar otro PDF
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </ToolShell>
  );
}
