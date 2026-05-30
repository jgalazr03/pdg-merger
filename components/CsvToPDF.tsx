'use client';

import { useState, useRef, useEffect } from 'react';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { Download, Loader2, Table, FileText, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn, scrollIntoViewSafe } from '@/lib/utils';
import { getTool } from '@/lib/tools';
import ToolShell from '@/components/tools/ToolShell';
import FileDropzone from '@/components/tools/FileDropzone';
import ToolConstraints from '@/components/tools/ToolConstraints';

const tool = getTool('csv-a-pdf');
const accent = tool.accent;

// Página Carta apaisada para que quepan más columnas en la tabla.
const PAGE_WIDTH = 792;
const PAGE_HEIGHT = 612;
const MARGIN = 40;
const FONT_SIZE = 9;
const ROW_PADDING = 6;
const ROW_HEIGHT = FONT_SIZE + ROW_PADDING * 2;

interface GeneratedPDF {
  blob: Blob;
  name: string;
  pages: number;
  rows: number;
  cols: number;
}

/**
 * Parser de CSV simple pero correcto para comillas básicas: respeta campos
 * entre comillas dobles (que pueden contener comas y saltos de línea) y la
 * comilla escapada como "". Maneja separadores de línea \n y \r\n.
 */
function parseCSV(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const text = input.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  while (i < text.length) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i += 1;
        }
      } else {
        field += char;
        i += 1;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      i += 1;
    } else if (char === ',') {
      row.push(field);
      field = '';
      i += 1;
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i += 1;
    } else {
      field += char;
      i += 1;
    }
  }

  // Último campo / fila si el archivo no termina en salto de línea.
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // Descarta filas totalmente vacías (p. ej. líneas en blanco al final).
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

export default function CsvToPDF() {
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<GeneratedPDF | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (result) {
      setTimeout(() => scrollIntoViewSafe(resultRef.current), 100);
    }
  }, [result]);

  const handleFileSelect = async (file: File) => {
    if (!/\.csv$/i.test(file.name) && file.type !== 'text/csv') {
      toast.error('Archivo no válido', {
        description: 'Selecciona un archivo .csv.',
      });
      return;
    }
    try {
      const text = await file.text();
      setCsvText(text);
      setFileName(file.name);
      setResult(null);
    } catch (error) {
      console.error('Error reading CSV:', error);
      toast.error('No se pudo leer el archivo', {
        description: 'Inténtalo de nuevo.',
      });
    }
  };

  const handleTextChange = (value: string) => {
    setCsvText(value);
    setFileName(null);
    if (result) setResult(null);
  };

  const clearInput = () => {
    setCsvText('');
    setFileName(null);
    setResult(null);
  };

  // Ajusta el texto de una celda al ancho de su columna, truncando con elipsis.
  const fitCell = (
    value: string,
    font: import('pdf-lib').PDFFont,
    size: number,
    maxWidth: number
  ): string => {
    const clean = value.replace(/\s+/g, ' ').trim();
    if (font.widthOfTextAtSize(clean, size) <= maxWidth) return clean;
    let truncated = clean;
    while (
      truncated.length > 1 &&
      font.widthOfTextAtSize(truncated + '…', size) > maxWidth
    ) {
      truncated = truncated.slice(0, -1);
    }
    return truncated + '…';
  };

  const generatePDF = async () => {
    if (!csvText.trim()) {
      toast.error('No hay datos', {
        description: 'Sube un archivo .csv o pega datos CSV.',
      });
      return;
    }

    setIsProcessing(true);
    try {
      const rows = parseCSV(csvText);
      if (rows.length === 0) {
        toast.error('CSV vacío', {
          description: 'No se encontraron filas con datos.',
        });
        setIsProcessing(false);
        return;
      }

      const colCount = Math.max(...rows.map((r) => r.length));
      // Normaliza todas las filas al mismo número de columnas.
      const grid = rows.map((r) => {
        const filled = [...r];
        while (filled.length < colCount) filled.push('');
        return filled;
      });

      const header = grid[0];
      const bodyRows = grid.slice(1);

      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      const tableWidth = PAGE_WIDTH - MARGIN * 2;
      const colWidth = tableWidth / colCount;
      const cellPadding = 4;
      const cellMaxWidth = colWidth - cellPadding * 2;

      const headerBg = rgb(0.85, 0.88, 0.95); // navy claro
      const borderColor = rgb(0.06, 0.09, 0.16); // ink
      const textColor = rgb(0.06, 0.09, 0.16);

      let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      let y = PAGE_HEIGHT - MARGIN;

      const drawRow = (
        cells: string[],
        isHeader: boolean,
        topY: number
      ): void => {
        const bottomY = topY - ROW_HEIGHT;
        // Fondo del encabezado.
        if (isHeader) {
          page.drawRectangle({
            x: MARGIN,
            y: bottomY,
            width: tableWidth,
            height: ROW_HEIGHT,
            color: headerBg,
          });
        }
        const rowFont = isHeader ? boldFont : font;
        for (let c = 0; c < colCount; c++) {
          const cellX = MARGIN + c * colWidth;
          // Borde de celda.
          page.drawRectangle({
            x: cellX,
            y: bottomY,
            width: colWidth,
            height: ROW_HEIGHT,
            borderColor,
            borderWidth: 0.75,
          });
          const value = fitCell(cells[c] ?? '', rowFont, FONT_SIZE, cellMaxWidth);
          page.drawText(value, {
            x: cellX + cellPadding,
            y: bottomY + ROW_PADDING,
            size: FONT_SIZE,
            font: rowFont,
            color: textColor,
          });
        }
      };

      // Encabezado de la primera página.
      drawRow(header, true, y);
      y -= ROW_HEIGHT;

      for (const bodyRow of bodyRows) {
        // Salto de página: repite el encabezado arriba.
        if (y - ROW_HEIGHT < MARGIN) {
          page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
          y = PAGE_HEIGHT - MARGIN;
          drawRow(header, true, y);
          y -= ROW_HEIGHT;
        }
        drawRow(bodyRow, false, y);
        y -= ROW_HEIGHT;
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });

      setResult({
        blob,
        name: fileName ? fileName.replace(/\.csv$/i, '.pdf') : 'tabla.pdf',
        pages: pdfDoc.getPageCount(),
        rows: bodyRows.length,
        cols: colCount,
      });
      toast.success('PDF generado', {
        description: `${bodyRows.length} fila${bodyRows.length !== 1 ? 's' : ''} y ${colCount} columna${colCount !== 1 ? 's' : ''}.`,
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('No se pudo generar el PDF', {
        description: 'Revisa el formato del CSV e inténtalo de nuevo.',
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
    setCsvText('');
    setFileName(null);
    setResult(null);
  };

  const step: 1 | 2 | 3 = !csvText.trim() ? 1 : result ? 3 : 2;

  return (
    <ToolShell tool={tool} step={step}>
      <FileDropzone
        className="mb-4"
        accent={accent}
        accept=".csv,text/csv"
        idleTitle="Selecciona un archivo CSV"
        idleSubtitle="Haz clic aquí o arrastra y suelta tu archivo .csv (o pega los datos abajo)"
        dragTitle="Suelta el archivo CSV aquí"
        buttonLabel="Seleccionar archivo"
        ariaLabel="Seleccionar o arrastrar un archivo CSV"
        onFiles={(files) => handleFileSelect(files[0])}
      />

      <Card className="mb-4">
        <CardContent className="p-4 sm:p-6">
          <div className="mb-2 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Label
              htmlFor="csv-input"
              className="block text-sm font-medium text-ink"
            >
              <Table className="mr-2 inline h-4 w-4" />
              {fileName ? `Datos de "${fileName}"` : 'O pega tus datos CSV aquí'}
            </Label>
            {csvText && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearInput}
                className="shrink-0"
              >
                <X className="mr-2 h-4 w-4" />
                Limpiar
              </Button>
            )}
          </div>
          <Textarea
            id="csv-input"
            value={csvText}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder={'nombre,edad,ciudad\nAna,30,Madrid\nLuis,25,Lima'}
            className="min-h-[180px] resize-y rounded-lg border-3 border-ink bg-surface px-3 py-2.5 font-mono text-base md:text-sm"
          />
        </CardContent>
      </Card>

      <ToolConstraints items={tool.constraints} />

      {csvText.trim() && !result && (
        <Card className="mb-8 motion-safe:animate-slide-up">
          <CardContent className="p-4 text-center sm:p-6">
            <h2 className="mb-4 font-display text-lg font-bold text-ink">
              ¿Listo para generar?
            </h2>
            <p className="mb-6 text-muted-foreground">
              La primera fila se usará como encabezado de la tabla.
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
                  <Table className="mr-2 h-5 w-5" />
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
              Tabla con {result.rows} fila{result.rows !== 1 ? 's' : ''} y{' '}
              {result.cols} columna{result.cols !== 1 ? 's' : ''} en {result.pages}{' '}
              página{result.pages !== 1 ? 's' : ''}.
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
                Convertir otro CSV
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </ToolShell>
  );
}
