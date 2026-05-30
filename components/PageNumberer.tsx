'use client';

import { useState, useRef, useEffect } from 'react';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { FileText, Download, Loader2, X, Hash } from 'lucide-react';
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

const tool = getTool('numerar-paginas');
const accent = tool.accent;

type Position =
  | 'inferior-centro'
  | 'inferior-derecha'
  | 'inferior-izquierda'
  | 'superior-centro'
  | 'superior-derecha'
  | 'superior-izquierda';

type Format = 'simple' | 'fraccion' | 'pagina';

const POSITIONS: { value: Position; label: string }[] = [
  { value: 'inferior-centro', label: 'Inferior centro' },
  { value: 'inferior-derecha', label: 'Inferior derecha' },
  { value: 'inferior-izquierda', label: 'Inferior izquierda' },
  { value: 'superior-centro', label: 'Superior centro' },
  { value: 'superior-derecha', label: 'Superior derecha' },
  { value: 'superior-izquierda', label: 'Superior izquierda' },
];

const FORMATS: { value: Format; label: string }[] = [
  { value: 'simple', label: '1' },
  { value: 'fraccion', label: '1 / N' },
  { value: 'pagina', label: 'Página 1 de N' },
];

interface ResultPDF {
  name: string;
  blob: Blob;
}

const MARGIN = 20;
const SELECT_CLASS =
  'flex h-10 w-full cursor-pointer rounded-lg border-3 border-ink bg-surface px-2.5 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:text-sm';

export default function PageNumberer() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [position, setPosition] = useState<Position>('inferior-centro');
  const [format, setFormat] = useState<Format>('simple');
  const [startFrom, setStartFrom] = useState<number>(1);
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

  const buildLabel = (current: number, total: number): string => {
    switch (format) {
      case 'fraccion':
        return `${current} / ${total}`;
      case 'pagina':
        return `Página ${current} de ${total}`;
      default:
        return `${current}`;
    }
  };

  const addPageNumbers = async () => {
    if (!selectedFile) return;

    const start = Math.max(1, Math.floor(startFrom) || 1);
    if (start > totalPages) {
      toast.error('Página de inicio inválida', {
        description: `El documento solo tiene ${totalPages} páginas.`,
      });
      return;
    }

    setIsProcessing(true);
    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer);
      const font = await pdf.embedFont(StandardFonts.Helvetica);
      const navy = rgb(0.09, 0.13, 0.24);
      const size = 11;

      const pages = pdf.getPages();
      // Total de páginas que efectivamente se numeran (desde `start`).
      const numberedTotal = pages.length - (start - 1);

      pages.forEach((page, index) => {
        const pageNumber = index + 1;
        if (pageNumber < start) return;

        const current = pageNumber - (start - 1);
        const label = buildLabel(current, numberedTotal);
        const { width, height } = page.getSize();
        const textWidth = font.widthOfTextAtSize(label, size);

        const isTop = position.startsWith('superior');
        const y = isTop ? height - MARGIN - size : MARGIN;

        let x: number;
        if (position.endsWith('izquierda')) {
          x = MARGIN;
        } else if (position.endsWith('derecha')) {
          x = width - MARGIN - textWidth;
        } else {
          x = (width - textWidth) / 2;
        }

        page.drawText(label, { x, y, size, font, color: navy });
      });

      const pdfBytes = await pdf.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      setResult({
        name: `${selectedFile.name.replace(/\.pdf$/i, '')}_numerado.pdf`,
        blob,
      });
      toast.success('Números de página añadidos', {
        description: `Se numeraron ${numberedTotal} página${numberedTotal !== 1 ? 's' : ''}.`,
      });
    } catch (error) {
      console.error('Error numbering pages:', error);
      toast.error('No se pudieron numerar las páginas', {
        description: 'Inténtalo de nuevo.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadPDF = () => {
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
    setPosition('inferior-centro');
    setFormat('simple');
    setStartFrom(1);
    setResult(null);
  };

  const changeFileWithUndo = () => {
    if (!selectedFile) return;
    const snap = { selectedFile, totalPages, position, format, startFrom, result };
    resetAll();
    toastUndo('Archivo descartado', {
      description: 'Selecciona otro PDF, o recupéralo si fue un error.',
      onUndo: () => {
        setSelectedFile(snap.selectedFile);
        setTotalPages(snap.totalPages);
        setPosition(snap.position);
        setFormat(snap.format);
        setStartFrom(snap.startFrom);
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

            <div className="mt-6 grid gap-5 sm:grid-cols-3">
              <div>
                <Label htmlFor="pn-position" className="mb-2 block">
                  <Hash className="mr-2 inline h-4 w-4" />
                  Posición
                </Label>
                <select
                  id="pn-position"
                  value={position}
                  onChange={(e) => setPosition(e.target.value as Position)}
                  className={SELECT_CLASS}
                >
                  {POSITIONS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="pn-format" className="mb-2 block">
                  Formato
                </Label>
                <select
                  id="pn-format"
                  value={format}
                  onChange={(e) => setFormat(e.target.value as Format)}
                  className={SELECT_CLASS}
                >
                  {FORMATS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="pn-start" className="mb-2 block">
                  Empezar en la página
                </Label>
                <Input
                  id="pn-start"
                  type="number"
                  min={1}
                  max={totalPages || 1}
                  value={startFrom}
                  onChange={(e) => setStartFrom(Number(e.target.value))}
                />
              </div>
            </div>

            <div className={cn('mt-5 rounded-lg border-3 border-ink p-3', accent.soft)}>
              <p className={cn('text-sm', accent.softText)}>
                El número se dibuja en azul marino a {MARGIN}px del borde. Las
                páginas anteriores a la de inicio se quedan sin numerar.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedFile && !result && (
        <Card className="mb-8">
          <CardContent className="p-4 text-center sm:p-6">
            <h2 className="mb-4 font-display text-lg font-bold text-ink">
              ¿Listo para numerar?
            </h2>
            <p className="mb-6 text-muted-foreground">
              Se añadirán los números de página al documento.
            </p>
            <Button
              onClick={addPageNumbers}
              disabled={isProcessing}
              aria-busy={isProcessing}
              size="lg"
              className={accent.solid}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Numerando…
                </>
              ) : (
                <>
                  <Hash className="mr-2 h-5 w-5" />
                  Numerar páginas
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
                ¡Páginas numeradas!
              </h2>
              <p className="mb-4 text-ink">Tu PDF está listo para descargar.</p>
              <Button onClick={downloadPDF} size="lg" className={accent.solid}>
                <Download className="mr-2 h-5 w-5" />
                Descargar PDF
              </Button>
            </div>

            <div className="mt-6 text-center">
              <Button variant="outline" onClick={resetAll} size="lg">
                Procesar otro PDF
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </ToolShell>
  );
}
