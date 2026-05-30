'use client';

import { useState, useRef, useEffect } from 'react';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { Download, Loader2, Type, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn, scrollIntoViewSafe } from '@/lib/utils';
import { getTool } from '@/lib/tools';
import ToolShell from '@/components/tools/ToolShell';
import ToolConstraints from '@/components/tools/ToolConstraints';

const tool = getTool('texto-a-pdf');
const accent = tool.accent;

// Tamaños de página en puntos (1 pt = 1/72"). pdf-lib trabaja en puntos.
const PAGE_SIZES = {
  a4: { label: 'A4', width: 595.28, height: 841.89 },
  carta: { label: 'Carta', width: 612, height: 792 },
} as const;

type PageSizeKey = keyof typeof PAGE_SIZES;

interface GeneratedPDF {
  blob: Blob;
  name: string;
  pages: number;
}

export default function TextToPDF() {
  const [text, setText] = useState('');
  const [pageSize, setPageSize] = useState<PageSizeKey>('a4');
  const [fontSize, setFontSize] = useState(12);
  const [margin, setMargin] = useState(50);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<GeneratedPDF | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  // Al generar el PDF, baja al inicio de la sección de resultado.
  useEffect(() => {
    if (result) {
      setTimeout(() => scrollIntoViewSafe(resultRef.current), 100);
    }
  }, [result]);

  /**
   * Envuelve un párrafo en líneas que caben en `maxWidth`, midiendo cada palabra
   * con la fuente real. Una palabra más ancha que la línea se trocea por carácter
   * para no desbordar el margen.
   */
  const wrapParagraph = (
    paragraph: string,
    font: import('pdf-lib').PDFFont,
    size: number,
    maxWidth: number
  ): string[] => {
    if (paragraph.length === 0) return [''];

    const words = paragraph.split(/\s+/);
    const lines: string[] = [];
    let current = '';

    const pushBrokenWord = (word: string) => {
      let chunk = '';
      for (const char of word) {
        const next = chunk + char;
        if (font.widthOfTextAtSize(next, size) > maxWidth && chunk) {
          lines.push(chunk);
          chunk = char;
        } else {
          chunk = next;
        }
      }
      current = chunk;
    };

    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        current = candidate;
        continue;
      }
      // No cabe junto a lo acumulado: cierra la línea actual.
      if (current) {
        lines.push(current);
        current = '';
      }
      // La palabra sola tampoco cabe: trocearla por carácter.
      if (font.widthOfTextAtSize(word, size) > maxWidth) {
        pushBrokenWord(word);
      } else {
        current = word;
      }
    }

    if (current) lines.push(current);
    return lines.length > 0 ? lines : [''];
  };

  const generatePDF = async () => {
    if (!text.trim()) {
      toast.error('No hay texto', {
        description: 'Escribe o pega texto para generar el PDF.',
      });
      return;
    }

    setIsProcessing(true);
    try {
      const { width, height } = PAGE_SIZES[pageSize];
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

      const lineHeight = fontSize * 1.4;
      const maxWidth = width - margin * 2;
      const bottomLimit = margin;

      let page = pdfDoc.addPage([width, height]);
      let y = height - margin;

      // Respeta saltos de línea del usuario; cada renglón se envuelve por ancho.
      const sourceLines = text.replace(/\r\n/g, '\n').split('\n');

      for (const sourceLine of sourceLines) {
        const wrapped = wrapParagraph(sourceLine, font, fontSize, maxWidth);
        for (const line of wrapped) {
          if (y - lineHeight < bottomLimit) {
            page = pdfDoc.addPage([width, height]);
            y = height - margin;
          }
          page.drawText(line, {
            x: margin,
            y: y - fontSize,
            size: fontSize,
            font,
            color: rgb(0.06, 0.09, 0.16),
          });
          y -= lineHeight;
        }
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });

      setResult({
        blob,
        name: 'texto.pdf',
        pages: pdfDoc.getPageCount(),
      });
      toast.success('PDF generado', {
        description: `${pdfDoc.getPageCount()} página${pdfDoc.getPageCount() !== 1 ? 's' : ''}.`,
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('No se pudo generar el PDF', {
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
    setText('');
    setResult(null);
  };

  // Al editar el texto tras generar, invalida el resultado para regenerar.
  const handleTextChange = (value: string) => {
    setText(value);
    if (result) setResult(null);
  };

  const step: 1 | 2 | 3 = !text.trim() ? 1 : result ? 3 : 2;

  return (
    <ToolShell tool={tool} step={step}>
      <Card className="mb-4">
        <CardContent className="p-4 sm:p-6">
          <Label
            htmlFor="text-input"
            className="mb-2 block text-sm font-medium text-ink"
          >
            <Type className="mr-2 inline h-4 w-4" />
            Escribe o pega tu texto
          </Label>
          <Textarea
            id="text-input"
            value={text}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder="Escribe aquí el texto que quieres convertir en PDF…"
            className="min-h-[240px] resize-y rounded-lg border-3 border-ink bg-surface px-3 py-2.5 text-base md:text-sm"
          />
          <p className="mt-2 text-sm text-muted-foreground">
            {text.length} caracteres
          </p>
        </CardContent>
      </Card>

      <ToolConstraints items={tool.constraints} />

      {text.trim() && (
        <Card className="mb-8 motion-safe:animate-slide-up">
          <CardContent className="p-4 sm:p-6">
            <h2 className="mb-6 font-display text-lg font-bold text-ink">
              Opciones del documento
            </h2>

            <div className="mb-6">
              <Label className="mb-3 block text-sm font-medium text-ink">
                Tamaño de página
              </Label>
              <div className="grid grid-cols-2 gap-3">
                {(Object.keys(PAGE_SIZES) as PageSizeKey[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setPageSize(key)}
                    aria-pressed={pageSize === key}
                    className={cn(
                      'rounded-lg border-3 border-ink p-4 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2',
                      pageSize === key ? 'bg-highlight-soft' : 'bg-surface hover:bg-muted'
                    )}
                  >
                    <div className="font-bold text-ink">{PAGE_SIZES[key].label}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label
                  htmlFor="font-size"
                  className="mb-2 block text-sm font-medium text-ink"
                >
                  Tamaño de fuente (pt)
                </Label>
                <Input
                  id="font-size"
                  type="number"
                  min={6}
                  max={72}
                  value={fontSize}
                  onChange={(e) =>
                    setFontSize(Math.min(72, Math.max(6, Number(e.target.value) || 12)))
                  }
                />
              </div>
              <div>
                <Label
                  htmlFor="margin"
                  className="mb-2 block text-sm font-medium text-ink"
                >
                  Márgenes (pt)
                </Label>
                <Input
                  id="margin"
                  type="number"
                  min={0}
                  max={200}
                  value={margin}
                  onChange={(e) =>
                    setMargin(Math.min(200, Math.max(0, Number(e.target.value) || 0)))
                  }
                />
              </div>
            </div>

            <div className={cn('mt-6 rounded-lg border-3 border-ink p-3', accent.soft)}>
              <p className={cn('text-sm', accent.softText)}>
                Se usa la fuente Helvetica con saltos de línea y de página
                automáticos. Los saltos de línea de tu texto se respetan.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {text.trim() && !result && (
        <Card className="mb-8">
          <CardContent className="p-4 text-center sm:p-6">
            <h2 className="mb-4 font-display text-lg font-bold text-ink">
              ¿Listo para generar?
            </h2>
            <p className="mb-6 text-muted-foreground">
              Se creará un PDF en tamaño {PAGE_SIZES[pageSize].label} con tu texto.
            </p>
            <Button
              onClick={generatePDF}
              disabled={isProcessing}
              aria-busy={isProcessing}
              size="lg"
              className={accent.solid}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Generando…
                </>
              ) : (
                <>
                  <Type className="mr-2 h-5 w-5" />
                  Generar PDF
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card ref={resultRef} className="motion-safe:animate-slide-up">
          <CardContent className="p-4 text-center sm:p-6">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full border-3 border-ink bg-success text-white">
              <Download className="h-8 w-8" />
            </div>
            <h2 className="mb-2 text-lg font-bold text-success">¡PDF generado!</h2>
            <p className="mb-6 text-ink">
              Tu documento tiene {result.pages} página
              {result.pages !== 1 ? 's' : ''}.
            </p>
            <div className="mb-6 flex items-center justify-center gap-3 rounded-lg border-3 border-ink bg-surface p-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded border-2 border-ink bg-success text-white">
                <FileText className="h-5 w-5" />
              </div>
              <span className="truncate text-sm font-medium text-ink">
                {result.name}
              </span>
            </div>
            <div className="flex flex-col justify-center gap-3 sm:flex-row">
              <Button onClick={downloadPDF} size="lg" className={accent.solid}>
                <Download className="mr-2 h-5 w-5" />
                Descargar PDF
              </Button>
              <Button variant="outline" onClick={resetAll} size="lg">
                Empezar de nuevo
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </ToolShell>
  );
}
