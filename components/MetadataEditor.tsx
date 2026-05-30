'use client';

import { useState, useRef, useEffect } from 'react';
import { PDFDocument } from 'pdf-lib';
import { FileText, Download, Loader2, X, Tags, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { scrollIntoViewSafe } from '@/lib/utils';
import { toastUndo } from '@/lib/toast';
import { getTool } from '@/lib/tools';
import ToolShell from '@/components/tools/ToolShell';
import FileDropzone from '@/components/tools/FileDropzone';
import ToolConstraints from '@/components/tools/ToolConstraints';

const tool = getTool('metadatos-pdf');
const accent = tool.accent;

interface MetaForm {
  title: string;
  author: string;
  subject: string;
  keywords: string;
  creator: string;
}

const EMPTY_FORM: MetaForm = {
  title: '',
  author: '',
  subject: '',
  keywords: '',
  creator: '',
};

export default function MetadataEditor() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [form, setForm] = useState<MetaForm>(EMPTY_FORM);
  const [producer, setProducer] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [savedBlob, setSavedBlob] = useState<Blob | null>(null);
  const fileInfoRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedFile && fileInfoRef.current) {
      setTimeout(() => scrollIntoViewSafe(fileInfoRef.current), 100);
    }
  }, [selectedFile]);

  useEffect(() => {
    if (savedBlob) {
      setTimeout(() => scrollIntoViewSafe(resultRef.current), 100);
    }
  }, [savedBlob]);

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
    setSavedBlob(null);
    setForm(EMPTY_FORM);
    setProducer('');

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer, { updateMetadata: false });

      const keywords = pdf.getKeywords();

      setForm({
        title: pdf.getTitle() ?? '',
        author: pdf.getAuthor() ?? '',
        subject: pdf.getSubject() ?? '',
        keywords: keywords ?? '',
        creator: pdf.getCreator() ?? '',
      });
      setProducer(pdf.getProducer() ?? '');
    } catch (error) {
      console.error('Error loading PDF:', error);
      toast.error('No se pudo cargar el PDF', {
        description: 'Asegúrate de que sea un archivo válido.',
      });
      setSelectedFile(null);
      setForm(EMPTY_FORM);
      setProducer('');
    }
  };

  const updateField = (field: keyof MetaForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const saveMetadata = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer, { updateMetadata: false });

      pdf.setTitle(form.title);
      pdf.setAuthor(form.author);
      pdf.setSubject(form.subject);
      pdf.setKeywords(
        form.keywords
          .split(',')
          .map((k) => k.trim())
          .filter((k) => k.length > 0)
      );
      pdf.setCreator(form.creator);

      const pdfBytes = await pdf.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      setSavedBlob(blob);
      toast.success('Metadatos actualizados');
    } catch (error) {
      console.error('Error saving metadata:', error);
      toast.error('No se pudieron guardar los metadatos', {
        description: 'Inténtalo de nuevo.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadPDF = () => {
    if (!savedBlob || !selectedFile) return;
    const url = URL.createObjectURL(savedBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selectedFile.name.replace(/\.pdf$/i, '')}_metadatos.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const resetAll = () => {
    setSelectedFile(null);
    setForm(EMPTY_FORM);
    setProducer('');
    setSavedBlob(null);
  };

  const changeFileWithUndo = () => {
    if (!selectedFile) return;
    const snap = { selectedFile, form, producer, savedBlob };
    resetAll();
    toastUndo('Archivo descartado', {
      description: 'Selecciona otro PDF, o recupéralo si fue un error.',
      onUndo: () => {
        setSelectedFile(snap.selectedFile);
        setForm(snap.form);
        setProducer(snap.producer);
        setSavedBlob(snap.savedBlob);
      },
    });
  };

  const step: 1 | 2 | 3 = !selectedFile ? 1 : savedBlob ? 3 : 2;

  const fields: { key: keyof MetaForm; label: string; placeholder: string }[] = [
    { key: 'title', label: 'Título', placeholder: 'Título del documento' },
    { key: 'author', label: 'Autor', placeholder: 'Nombre del autor' },
    { key: 'subject', label: 'Asunto', placeholder: 'Tema o asunto del documento' },
    {
      key: 'keywords',
      label: 'Palabras clave',
      placeholder: 'Separa con comas: factura, 2026, cliente',
    },
    { key: 'creator', label: 'Creador', placeholder: 'Aplicación que creó el documento' },
  ];

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

      {selectedFile && !savedBlob && (
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

            <div className="mt-6 space-y-4">
              <h3 className="flex items-center gap-2 font-display font-bold text-ink">
                <Tags className="h-4 w-4" />
                Metadatos del documento
              </h3>
              {fields.map((f) => (
                <div key={f.key}>
                  <Label
                    htmlFor={`meta-${f.key}`}
                    className="mb-2 block text-sm font-medium text-ink"
                  >
                    {f.label}
                  </Label>
                  <Input
                    id={`meta-${f.key}`}
                    type="text"
                    placeholder={f.placeholder}
                    value={form[f.key]}
                    onChange={(e) => updateField(f.key, e.target.value)}
                  />
                </div>
              ))}

              {producer && (
                <p className="text-sm text-muted-foreground">
                  Productor (solo lectura): <span className="text-ink">{producer}</span>
                </p>
              )}

              <Button
                onClick={saveMetadata}
                disabled={isProcessing}
                aria-busy={isProcessing}
                size="lg"
                className={accent.solid}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Guardando…
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-5 w-5" />
                    Guardar metadatos
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {savedBlob && (
        <Card ref={resultRef} className="motion-safe:animate-slide-up">
          <CardContent className="p-4 sm:p-6">
            <div className="mb-6 text-center">
              <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full border-3 border-ink bg-success text-white">
                <Download className="h-8 w-8" />
              </div>
              <h2 className="mb-2 text-lg font-bold text-success">
                ¡Metadatos actualizados!
              </h2>
              <p className="mb-4 text-ink">Tu PDF está listo para descargar.</p>
              <Button onClick={downloadPDF} size="lg" className={accent.solid}>
                <Download className="mr-2 h-5 w-5" />
                Descargar PDF
              </Button>
            </div>

            <div className="text-center">
              <Button variant="outline" onClick={resetAll} size="lg">
                Editar otro PDF
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </ToolShell>
  );
}
