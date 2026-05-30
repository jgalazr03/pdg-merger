'use client';

import { useState, useRef, useEffect } from 'react';
import { PDFDocument } from 'pdf-lib';
import { FileText, Loader2, X, Info } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn, scrollIntoViewSafe } from '@/lib/utils';
import { toastUndo } from '@/lib/toast';
import { getTool } from '@/lib/tools';
import ToolShell from '@/components/tools/ToolShell';
import FileDropzone from '@/components/tools/FileDropzone';
import ToolConstraints from '@/components/tools/ToolConstraints';

const tool = getTool('info-pdf');
const accent = tool.accent;

interface PdfReport {
  name: string;
  size: string;
  pageCount: number;
  firstWidthPt: number;
  firstHeightPt: number;
  firstWidthMm: number;
  firstHeightMm: number;
  uniformSize: boolean;
  encrypted: boolean;
  title: string;
  author: string;
  subject: string;
  creator: string;
  producer: string;
  creationDate: string;
  modificationDate: string;
}

const PT_TO_MM = 25.4 / 72;
const NONE = '—';

export default function PDFInspector() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [report, setReport] = useState<PdfReport | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (report) {
      setTimeout(() => scrollIntoViewSafe(resultRef.current), 100);
    }
  }, [report]);

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

  const round = (n: number) => Math.round(n * 10) / 10;

  const analyzeFile = async (file: File) => {
    if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) {
      toast.error('Archivo no válido', {
        description: 'Por favor selecciona un archivo PDF.',
      });
      return;
    }

    setSelectedFile(file);
    setReport(null);
    setIsProcessing(true);

    try {
      const arrayBuffer = await file.arrayBuffer();

      let pdf: PDFDocument;
      let encrypted = false;

      try {
        pdf = await PDFDocument.load(arrayBuffer);
      } catch (err) {
        // Reintenta ignorando el cifrado para poder inspeccionarlo igualmente.
        const message = err instanceof Error ? err.message.toLowerCase() : '';
        if (message.includes('encrypt')) {
          pdf = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
          encrypted = true;
        } else {
          throw err;
        }
      }

      // pdf.isEncrypted está disponible en pdf-lib aunque la carga haya tenido éxito.
      if (typeof (pdf as unknown as { isEncrypted?: boolean }).isEncrypted === 'boolean') {
        encrypted = encrypted || (pdf as unknown as { isEncrypted: boolean }).isEncrypted;
      }

      const pages = pdf.getPages();
      const pageCount = pages.length;

      let firstWidthPt = 0;
      let firstHeightPt = 0;
      let uniformSize = true;

      if (pageCount > 0) {
        const first = pages[0].getSize();
        firstWidthPt = first.width;
        firstHeightPt = first.height;
        uniformSize = pages.every((p) => {
          const s = p.getSize();
          return (
            Math.abs(s.width - firstWidthPt) < 0.5 &&
            Math.abs(s.height - firstHeightPt) < 0.5
          );
        });
      }

      let creationDate = '';
      let modificationDate = '';
      try {
        creationDate = formatDate(pdf.getCreationDate());
      } catch {
        /* fecha inválida: ignorar */
      }
      try {
        modificationDate = formatDate(pdf.getModificationDate());
      } catch {
        /* fecha inválida: ignorar */
      }

      setReport({
        name: file.name,
        size: formatFileSize(file.size),
        pageCount,
        firstWidthPt: round(firstWidthPt),
        firstHeightPt: round(firstHeightPt),
        firstWidthMm: round(firstWidthPt * PT_TO_MM),
        firstHeightMm: round(firstHeightPt * PT_TO_MM),
        uniformSize,
        encrypted,
        title: pdf.getTitle() ?? '',
        author: pdf.getAuthor() ?? '',
        subject: pdf.getSubject() ?? '',
        creator: pdf.getCreator() ?? '',
        producer: pdf.getProducer() ?? '',
        creationDate,
        modificationDate,
      });
    } catch (error) {
      console.error('Error analyzing PDF:', error);
      toast.error('No se pudo analizar el PDF', {
        description: 'Asegúrate de que sea un archivo válido.',
      });
      setSelectedFile(null);
      setReport(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const resetAll = () => {
    setSelectedFile(null);
    setReport(null);
  };

  const changeFileWithUndo = () => {
    if (!selectedFile) return;
    const snap = { selectedFile, report };
    resetAll();
    toastUndo('Archivo descartado', {
      description: 'Selecciona otro PDF, o recupéralo si fue un error.',
      onUndo: () => {
        setSelectedFile(snap.selectedFile);
        setReport(snap.report);
      },
    });
  };

  const step: 1 | 2 | 3 = !selectedFile ? 1 : 2;

  const rows: { label: string; value: string }[] = report
    ? [
        { label: 'Nombre', value: report.name },
        { label: 'Tamaño', value: report.size },
        { label: 'Páginas', value: String(report.pageCount) },
        {
          label: 'Dimensiones (1.ª página)',
          value:
            report.pageCount > 0
              ? `${report.firstWidthPt} × ${report.firstHeightPt} pt  ·  ${report.firstWidthMm} × ${report.firstHeightMm} mm`
              : NONE,
        },
        {
          label: 'Tamaño de páginas',
          value:
            report.pageCount > 0
              ? report.uniformSize
                ? 'Todas iguales'
                : 'Varían entre páginas'
              : NONE,
        },
        { label: 'Cifrado', value: report.encrypted ? 'Sí' : 'No' },
        { label: 'Título', value: report.title || NONE },
        { label: 'Autor', value: report.author || NONE },
        { label: 'Asunto', value: report.subject || NONE },
        { label: 'Creador', value: report.creator || NONE },
        { label: 'Productor', value: report.producer || NONE },
        { label: 'Fecha de creación', value: report.creationDate || NONE },
        { label: 'Fecha de modificación', value: report.modificationDate || NONE },
      ]
    : [];

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
        onFiles={(files) => analyzeFile(files[0])}
      />

      <ToolConstraints items={tool.constraints} />

      {selectedFile && isProcessing && !report && (
        <Card className="mb-8">
          <CardContent className="flex items-center justify-center gap-3 p-8 text-ink">
            <Loader2 className={cn('h-6 w-6 animate-spin', accent.text)} />
            <span className="font-medium">Analizando documento…</span>
          </CardContent>
        </Card>
      )}

      {report && (
        <Card ref={resultRef} className="motion-safe:animate-slide-up">
          <CardContent className="p-4 sm:p-6">
            <div className="mb-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="flex items-center gap-2 font-display text-lg font-bold text-ink">
                <Info className={cn('h-5 w-5', accent.text)} />
                Información del documento
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
                <p className="truncate font-medium text-ink">{report.name}</p>
                <p className="text-sm text-muted-foreground">
                  {report.size} • {report.pageCount} páginas
                </p>
              </div>
            </div>

            <div className="mt-6 overflow-hidden rounded-lg border-3 border-ink">
              {rows.map((r, i) => (
                <div
                  key={r.label}
                  className={cn(
                    'flex flex-col gap-0.5 p-3 sm:flex-row sm:gap-4',
                    i > 0 && 'border-t-3 border-ink'
                  )}
                >
                  <span className="shrink-0 text-sm font-bold text-ink sm:w-52">
                    {r.label}
                  </span>
                  <span className="min-w-0 break-words text-sm text-muted-foreground">
                    {r.value}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-6 text-center">
              <Button variant="outline" onClick={resetAll} size="lg">
                Analizar otro PDF
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </ToolShell>
  );
}
