'use client';

import { useState, useRef, useEffect } from 'react';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { FileText, Download, Loader2, X, BookOpen, AlertCircle } from 'lucide-react';
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

const tool = getTool('portada-pdf');
const accent = tool.accent;

// Navy de marca para el texto de la portada, según contrato.
const NAVY = rgb(0, 0, 0.27);

interface ResultPDF {
  name: string;
  blob: Blob;
  pageCount: number;
}

/** Fecha de hoy formateada en español, p. ej. "30 de mayo de 2026". */
function todayInSpanish(): string {
  const formatted = new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

/**
 * Divide un texto en líneas que quepan en `maxWidth` a un `size` dado,
 * partiendo por palabras. Evita que el título grande se salga de la página.
 */
function wrapText(
  text: string,
  font: import('pdf-lib').PDFFont,
  size: number,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

export default function CoverPageMaker() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [title, setTitle] = useState<string>('');
  const [subtitle, setSubtitle] = useState<string>('');
  const [dateText, setDateText] = useState<string>('');
  const [titleError, setTitleError] = useState<string>('');
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
    setTitle('');
    setSubtitle('');
    setDateText(todayInSpanish());
    setTitleError('');

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

  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (value.trim()) setTitleError('');
  };

  const makeCover = async () => {
    if (!selectedFile) return;
    if (!title.trim()) {
      setTitleError('El título es obligatorio.');
      toast.error('Falta el título', {
        description: 'Escribe un título para la portada.',
      });
      return;
    }

    setIsProcessing(true);
    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer);

      const helvetica = await pdf.embedFont(StandardFonts.Helvetica);
      const helveticaBold = await pdf.embedFont(StandardFonts.HelveticaBold);

      // Tamaño de portada = tamaño de la primera página del documento.
      const firstPage = pdf.getPage(0);
      const { width, height } = firstPage.getSize();

      const cover = pdf.insertPage(0, [width, height]);

      const margin = width * 0.12;
      const maxTextWidth = width - margin * 2;

      // --- Título (grande, Helvetica-Bold, centrado, con ajuste de línea) ---
      let titleSize = Math.min(40, Math.max(22, width / 14));
      let titleLines = wrapText(title.trim(), helveticaBold, titleSize, maxTextWidth);
      // Reduce el tamaño si quedan demasiadas líneas para una portada.
      while (titleLines.length > 4 && titleSize > 16) {
        titleSize -= 2;
        titleLines = wrapText(title.trim(), helveticaBold, titleSize, maxTextWidth);
      }
      const titleLineHeight = titleSize * 1.25;

      const subtitleSize = Math.min(20, Math.max(13, width / 28));
      const subtitleLines = subtitle.trim()
        ? wrapText(subtitle.trim(), helvetica, subtitleSize, maxTextWidth)
        : [];
      const subtitleLineHeight = subtitleSize * 1.35;

      const dateSize = Math.min(16, Math.max(11, width / 36));
      const dateValue = dateText.trim();

      // Huecos entre bloques (solo cuentan si el bloque siguiente existe).
      const gapAfterTitle = subtitleLines.length ? subtitleSize * 1.6 : 0;
      const gapBeforeDate = dateValue ? dateSize * 2 : 0;

      // Construimos una lista de líneas a dibujar (texto, fuente, tamaño,
      // interlineado, y el hueco que la PRECEDE) y luego las centramos
      // verticalmente como un solo bloque. El origen de pdf-lib es
      // abajo-izquierda; `y` indica la línea base de cada texto.
      type DrawLine = {
        text: string;
        font: import('pdf-lib').PDFFont;
        size: number;
        lineHeight: number;
        gapBefore: number;
      };
      const drawLines: DrawLine[] = [];

      titleLines.forEach((line) => {
        drawLines.push({
          text: line,
          font: helveticaBold,
          size: titleSize,
          lineHeight: titleLineHeight,
          gapBefore: 0,
        });
      });
      subtitleLines.forEach((line, i) => {
        drawLines.push({
          text: line,
          font: helvetica,
          size: subtitleSize,
          lineHeight: subtitleLineHeight,
          gapBefore: i === 0 ? gapAfterTitle : 0,
        });
      });
      if (dateValue) {
        drawLines.push({
          text: dateValue,
          font: helvetica,
          size: dateSize,
          lineHeight: dateSize,
          gapBefore: gapBeforeDate,
        });
      }

      const blockHeight = drawLines.reduce(
        (acc, l) => acc + l.gapBefore + l.lineHeight,
        0
      );

      // Tope del bloque centrado verticalmente. Bajamos la línea base de cada
      // texto restando su hueco y su tamaño (alto de la mayúscula aprox.).
      let cursorY = height / 2 + blockHeight / 2;
      for (const l of drawLines) {
        cursorY -= l.gapBefore + l.size;
        const lineWidth = l.font.widthOfTextAtSize(l.text, l.size);
        cover.drawText(l.text, {
          x: (width - lineWidth) / 2,
          y: cursorY,
          size: l.size,
          font: l.font,
          color: NAVY,
        });
        cursorY -= l.lineHeight - l.size;
      }

      const pdfBytes = await pdf.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });

      setResult({
        name: `${selectedFile.name.replace(/\.pdf$/i, '')}_con-portada.pdf`,
        blob,
        pageCount: pdf.getPageCount(),
      });
      toast.success('Portada añadida al inicio del PDF');
    } catch (error) {
      console.error('Error creating cover page:', error);
      toast.error('No se pudo crear la portada', {
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
    setTitle('');
    setSubtitle('');
    setDateText('');
    setTitleError('');
    setResult(null);
  };

  const changeFileWithUndo = () => {
    if (!selectedFile) return;
    const snap = { selectedFile, totalPages, title, subtitle, dateText, result };
    resetAll();
    toastUndo('Archivo descartado', {
      description: 'Selecciona otro PDF, o recupéralo si fue un error.',
      onUndo: () => {
        setSelectedFile(snap.selectedFile);
        setTotalPages(snap.totalPages);
        setTitle(snap.title);
        setSubtitle(snap.subtitle);
        setDateText(snap.dateText);
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
        loaded={step > 1}
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

            <div className="mt-6 space-y-5">
              <div>
                <Label htmlFor="cover-title" className="mb-2 block text-sm font-medium text-ink">
                  <BookOpen className="mr-2 inline h-4 w-4" />
                  Título <span className="text-brand-red">*</span>
                </Label>
                <Input
                  id="cover-title"
                  type="text"
                  placeholder="Ej: Informe anual 2026"
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  aria-invalid={!!titleError}
                  aria-describedby={titleError ? 'cover-title-error' : undefined}
                  className={cn(titleError && 'border-brand-red focus-visible:ring-ink')}
                />
                {titleError && (
                  <div
                    className="mt-2 flex items-start gap-2 text-sm text-brand-red"
                    id="cover-title-error"
                  >
                    <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <span>{titleError}</span>
                  </div>
                )}
              </div>

              <div>
                <Label htmlFor="cover-subtitle" className="mb-2 block text-sm font-medium text-ink">
                  Subtítulo
                </Label>
                <Input
                  id="cover-subtitle"
                  type="text"
                  placeholder="Ej: Resultados y proyecciones"
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="cover-date" className="mb-2 block text-sm font-medium text-ink">
                  Fecha
                </Label>
                <Input
                  id="cover-date"
                  type="text"
                  placeholder="Ej: 30 de mayo de 2026"
                  value={dateText}
                  onChange={(e) => setDateText(e.target.value)}
                />
              </div>

              <div className={cn('rounded-lg border-3 border-ink p-3', accent.soft)}>
                <p className={cn('text-sm', accent.softText)}>
                  La portada se genera con el tamaño de la primera página del PDF y se
                  inserta al inicio del documento, con el título centrado en navy.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedFile && !result && (
        <Card className="mb-8">
          <CardContent className="p-4 text-center sm:p-6">
            <h2 className="mb-4 font-display text-lg font-bold text-ink">
              ¿Listo para añadir la portada?
            </h2>
            <p className="mb-6 text-muted-foreground">
              Se insertará una nueva página de portada al inicio del documento.
            </p>
            <Button
              onClick={makeCover}
              disabled={isProcessing}
              aria-busy={isProcessing}
              size="lg"
              className={accent.solid}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Creando portada…
                </>
              ) : (
                <>
                  <BookOpen className="mr-2 h-5 w-5" />
                  Añadir portada
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
                ¡Portada añadida!
              </h2>
              <p className="mb-4 text-ink">
                Tu PDF ahora tiene {result.pageCount} páginas, con la portada al inicio.
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
                Añadir portada a otro PDF
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </ToolShell>
  );
}
