'use client';

import { useState, useRef, useEffect } from 'react';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { FileText, Download, Loader2, X, Heading } from 'lucide-react';
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

const tool = getTool('encabezado-pie');
const accent = tool.accent;

type Align = 'left' | 'center' | 'right';

const ALIGNS: { value: Align; label: string }[] = [
  { value: 'left', label: 'Izquierda' },
  { value: 'center', label: 'Centro' },
  { value: 'right', label: 'Derecha' },
];

interface ResultPDF {
  name: string;
  blob: Blob;
}

const MARGIN = 20;
const SELECT_CLASS =
  'flex h-10 w-full cursor-pointer rounded-lg border-3 border-ink bg-surface px-2.5 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:text-sm';

export default function HeaderFooter() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [headerText, setHeaderText] = useState<string>('');
  const [headerAlign, setHeaderAlign] = useState<Align>('center');
  const [footerText, setFooterText] = useState<string>('');
  const [footerAlign, setFooterAlign] = useState<Align>('center');
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

  const fillTokens = (template: string, current: number, total: number): string =>
    template
      .replace(/\{pagina\}/gi, String(current))
      .replace(/\{total\}/gi, String(total));

  const xForAlign = (
    align: Align,
    width: number,
    textWidth: number
  ): number => {
    if (align === 'left') return MARGIN;
    if (align === 'right') return width - MARGIN - textWidth;
    return (width - textWidth) / 2;
  };

  const applyHeaderFooter = async () => {
    if (!selectedFile) return;

    const hasHeader = headerText.trim().length > 0;
    const hasFooter = footerText.trim().length > 0;
    if (!hasHeader && !hasFooter) {
      toast.error('Sin contenido', {
        description: 'Escribe al menos el encabezado o el pie de página.',
      });
      return;
    }

    setIsProcessing(true);
    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer);
      const font = await pdf.embedFont(StandardFonts.Helvetica);
      const navy = rgb(0.09, 0.13, 0.24);
      const size = 10;

      const pages = pdf.getPages();
      const total = pages.length;

      pages.forEach((page, index) => {
        const current = index + 1;
        const { width, height } = page.getSize();

        if (hasHeader) {
          const label = fillTokens(headerText, current, total);
          if (label.length > 0) {
            const textWidth = font.widthOfTextAtSize(label, size);
            page.drawText(label, {
              x: xForAlign(headerAlign, width, textWidth),
              y: height - MARGIN - size,
              size,
              font,
              color: navy,
            });
          }
        }

        if (hasFooter) {
          const label = fillTokens(footerText, current, total);
          if (label.length > 0) {
            const textWidth = font.widthOfTextAtSize(label, size);
            page.drawText(label, {
              x: xForAlign(footerAlign, width, textWidth),
              y: MARGIN,
              size,
              font,
              color: navy,
            });
          }
        }
      });

      const pdfBytes = await pdf.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      setResult({
        name: `${selectedFile.name.replace(/\.pdf$/i, '')}_encabezado-pie.pdf`,
        blob,
      });
      toast.success('Encabezado y pie aplicados', {
        description: `Se actualizaron ${total} página${total !== 1 ? 's' : ''}.`,
      });
    } catch (error) {
      console.error('Error applying header/footer:', error);
      toast.error('No se pudo aplicar el encabezado/pie', {
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
    setHeaderText('');
    setHeaderAlign('center');
    setFooterText('');
    setFooterAlign('center');
    setResult(null);
  };

  const changeFileWithUndo = () => {
    if (!selectedFile) return;
    const snap = {
      selectedFile,
      totalPages,
      headerText,
      headerAlign,
      footerText,
      footerAlign,
      result,
    };
    resetAll();
    toastUndo('Archivo descartado', {
      description: 'Selecciona otro PDF, o recupéralo si fue un error.',
      onUndo: () => {
        setSelectedFile(snap.selectedFile);
        setTotalPages(snap.totalPages);
        setHeaderText(snap.headerText);
        setHeaderAlign(snap.headerAlign);
        setFooterText(snap.footerText);
        setFooterAlign(snap.footerAlign);
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

            <div className="mt-6 space-y-6">
              {/* Encabezado */}
              <div className="rounded-lg border-3 border-ink bg-surface p-4">
                <h3 className="mb-3 font-display font-bold text-ink">
                  <Heading className="mr-2 inline h-4 w-4" />
                  Encabezado
                </h3>
                <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
                  <div>
                    <Label htmlFor="hf-header-text" className="mb-2 block">
                      Texto (opcional)
                    </Label>
                    <Input
                      id="hf-header-text"
                      type="text"
                      placeholder="Ej: Informe trimestral"
                      value={headerText}
                      onChange={(e) => setHeaderText(e.target.value)}
                    />
                  </div>
                  <div className="sm:w-44">
                    <Label htmlFor="hf-header-align" className="mb-2 block">
                      Alineación
                    </Label>
                    <select
                      id="hf-header-align"
                      value={headerAlign}
                      onChange={(e) => setHeaderAlign(e.target.value as Align)}
                      className={SELECT_CLASS}
                    >
                      {ALIGNS.map((a) => (
                        <option key={a.value} value={a.value}>
                          {a.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Pie */}
              <div className="rounded-lg border-3 border-ink bg-surface p-4">
                <h3 className="mb-3 font-display font-bold text-ink">
                  <Heading className="mr-2 inline h-4 w-4 rotate-180" />
                  Pie de página
                </h3>
                <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
                  <div>
                    <Label htmlFor="hf-footer-text" className="mb-2 block">
                      Texto (opcional)
                    </Label>
                    <Input
                      id="hf-footer-text"
                      type="text"
                      placeholder="Ej: Página {pagina} de {total}"
                      value={footerText}
                      onChange={(e) => setFooterText(e.target.value)}
                    />
                  </div>
                  <div className="sm:w-44">
                    <Label htmlFor="hf-footer-align" className="mb-2 block">
                      Alineación
                    </Label>
                    <select
                      id="hf-footer-align"
                      value={footerAlign}
                      onChange={(e) => setFooterAlign(e.target.value as Align)}
                      className={SELECT_CLASS}
                    >
                      {ALIGNS.map((a) => (
                        <option key={a.value} value={a.value}>
                          {a.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className={cn('rounded-lg border-3 border-ink p-3', accent.soft)}>
                <p className={cn('text-sm font-bold', accent.softText)}>
                  Comodines disponibles:
                </p>
                <ul className={cn('mt-1 space-y-1 text-sm', accent.softText)}>
                  <li>• <code>{'{pagina}'}</code> — Número de la página actual</li>
                  <li>• <code>{'{total}'}</code> — Total de páginas del documento</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedFile && !result && (
        <Card className="mb-8">
          <CardContent className="p-4 text-center sm:p-6">
            <h2 className="mb-4 font-display text-lg font-bold text-ink">
              ¿Listo para aplicar?
            </h2>
            <p className="mb-6 text-muted-foreground">
              Se añadirá el encabezado y/o pie a todas las páginas del documento.
            </p>
            <Button
              onClick={applyHeaderFooter}
              disabled={isProcessing}
              aria-busy={isProcessing}
              size="lg"
              className={accent.solid}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Aplicando…
                </>
              ) : (
                <>
                  <Heading className="mr-2 h-5 w-5" />
                  Aplicar encabezado y pie
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
                ¡Encabezado y pie aplicados!
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
