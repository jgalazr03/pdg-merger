'use client';

import { useState, useRef, useEffect } from 'react';
import { PDFDocument } from 'pdf-lib';
import { FileText, Download, Loader2, X, Columns2, Grid2x2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { cn, scrollIntoViewSafe } from '@/lib/utils';
import { toastUndo } from '@/lib/toast';
import { getTool } from '@/lib/tools';
import ToolShell from '@/components/tools/ToolShell';
import FileDropzone from '@/components/tools/FileDropzone';
import ToolConstraints from '@/components/tools/ToolConstraints';

const tool = getTool('nup-pdf');
const accent = tool.accent;

// Dimensiones A4 en puntos.
const A4_W = 595.28;
const A4_H = 841.89;
const MARGIN = 20; // margen exterior de la hoja
const GUTTER = 12; // separación entre celdas

type Layout = 2 | 4;

export default function NupComposer() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [layout, setLayout] = useState<Layout>(2);
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [resultPages, setResultPages] = useState<number>(0);

  const fileInfoRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedFile && fileInfoRef.current) {
      setTimeout(() => scrollIntoViewSafe(fileInfoRef.current), 100);
    }
  }, [selectedFile]);

  useEffect(() => {
    if (resultBlob) {
      setTimeout(() => scrollIntoViewSafe(resultRef.current), 100);
    }
  }, [resultBlob]);

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
    setResultBlob(null);
    setResultPages(0);
    setLayout(2);

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

  const composeNup = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const srcPdf = await PDFDocument.load(arrayBuffer);
      const outPdf = await PDFDocument.create();

      const srcCount = srcPdf.getPageCount();
      const srcIndices = Array.from({ length: srcCount }, (_, i) => i);

      // 2-up → A4 horizontal, una fila de 2 celdas.
      // 4-up → A4 vertical, rejilla 2x2.
      const sheetW = layout === 2 ? A4_H : A4_W;
      const sheetH = layout === 2 ? A4_W : A4_H;
      const cols = layout === 2 ? 2 : 2;
      const rows = layout === 2 ? 1 : 2;

      const cellW = (sheetW - MARGIN * 2 - GUTTER * (cols - 1)) / cols;
      const cellH = (sheetH - MARGIN * 2 - GUTTER * (rows - 1)) / rows;

      // Embeber todas las páginas origen de una vez.
      const embedded = await outPdf.embedPdf(srcPdf, srcIndices);

      const perSheet = layout;
      let sheetsMade = 0;

      for (let i = 0; i < embedded.length; i += perSheet) {
        const sheet = outPdf.addPage([sheetW, sheetH]);
        const group = embedded.slice(i, i + perSheet);

        group.forEach((emb, idx) => {
          const col = idx % cols;
          const row = Math.floor(idx / cols);

          // Escala para encajar la página en la celda manteniendo proporción.
          const scale = Math.min(emb.width === 0 ? 1 : cellW / emb.width, emb.height === 0 ? 1 : cellH / emb.height);
          const drawW = emb.width * scale;
          const drawH = emb.height * scale;

          // Esquina inferior-izquierda de la celda (origen abajo-izquierda).
          const cellX = MARGIN + col * (cellW + GUTTER);
          // Las filas se cuentan desde arriba; convertir a coordenada inferior.
          const cellTop = sheetH - MARGIN - row * (cellH + GUTTER);
          const cellBottom = cellTop - cellH;

          // Centrar el contenido dentro de la celda.
          const x = cellX + (cellW - drawW) / 2;
          const y = cellBottom + (cellH - drawH) / 2;

          sheet.drawPage(emb, { x, y, xScale: scale, yScale: scale });
        });

        sheetsMade += 1;
      }

      const pdfBytes = await outPdf.save();
      setResultBlob(new Blob([pdfBytes], { type: 'application/pdf' }));
      setResultPages(sheetsMade);
      toast.success(
        `Se ${sheetsMade === 1 ? 'creó' : 'crearon'} ${sheetsMade} hoja${sheetsMade !== 1 ? 's' : ''}`
      );
    } catch (error) {
      console.error('Error composing N-up PDF:', error);
      toast.error('No se pudo componer el PDF', {
        description: 'Inténtalo de nuevo.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadResult = () => {
    if (!resultBlob || !selectedFile) return;
    const url = URL.createObjectURL(resultBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selectedFile.name.replace(/\.pdf$/i, '')}_${layout}-por-hoja.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const resetAll = () => {
    setSelectedFile(null);
    setTotalPages(0);
    setLayout(2);
    setResultBlob(null);
    setResultPages(0);
  };

  const changeFileWithUndo = () => {
    if (!selectedFile) return;
    const snap = { selectedFile, totalPages };
    resetAll();
    toastUndo('Archivo descartado', {
      description: 'Selecciona otro PDF, o recupéralo si fue un error.',
      onUndo: () => {
        setSelectedFile(snap.selectedFile);
        setTotalPages(snap.totalPages);
      },
    });
  };

  const step: 1 | 2 | 3 = !selectedFile ? 1 : resultBlob ? 3 : 2;

  const expectedSheets = totalPages > 0 ? Math.ceil(totalPages / layout) : 0;

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

      {selectedFile && !resultBlob && (
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
                <p className="truncate font-medium text-ink">
                  {selectedFile.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatFileSize(selectedFile.size)} • {totalPages} páginas
                </p>
              </div>
            </div>

            <div className="mt-6">
              <Label className="mb-2 block text-sm font-medium text-ink">
                Páginas por hoja
              </Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setLayout(2)}
                  aria-pressed={layout === 2}
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-lg border-3 border-ink px-3 py-4 text-sm font-bold transition-[transform,background-color,color] active:scale-[0.98]',
                    layout === 2
                      ? accent.solid
                      : 'bg-surface text-ink hover-fine:bg-muted'
                  )}
                >
                  <Columns2 className="h-6 w-6" />
                  2 por hoja (A4 horizontal)
                </button>
                <button
                  type="button"
                  onClick={() => setLayout(4)}
                  aria-pressed={layout === 4}
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-lg border-3 border-ink px-3 py-4 text-sm font-bold transition-[transform,background-color,color] active:scale-[0.98]',
                    layout === 4
                      ? accent.solid
                      : 'bg-surface text-ink hover-fine:bg-muted'
                  )}
                >
                  <Grid2x2 className="h-6 w-6" />
                  4 por hoja (A4 vertical 2x2)
                </button>
              </div>

              <div
                className={cn(
                  'mt-3 rounded-lg border-3 border-ink p-3',
                  accent.soft
                )}
              >
                <p className={cn('text-sm font-bold', accent.softText)}>
                  {totalPages} páginas → {expectedSheets} hoja
                  {expectedSheets !== 1 ? 's' : ''} con {layout} por hoja.
                </p>
              </div>
            </div>

            <div className="mt-6 text-center">
              <Button
                onClick={composeNup}
                disabled={isProcessing}
                aria-busy={isProcessing}
                size="lg"
                className={accent.solid}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Componiendo…
                  </>
                ) : (
                  <>
                    {layout === 2 ? (
                      <Columns2 className="mr-2 h-5 w-5" />
                    ) : (
                      <Grid2x2 className="mr-2 h-5 w-5" />
                    )}
                    Componer {layout} por hoja
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {resultBlob && (
        <Card ref={resultRef} className="motion-safe:animate-slide-up">
          <CardContent className="p-4 text-center sm:p-6">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full border-3 border-ink bg-success text-white">
              <Download className="h-8 w-8" />
            </div>
            <h2 className="mb-2 text-lg font-bold text-success">
              ¡Composición lista!
            </h2>
            <p className="mb-6 text-ink">
              Se generaron {resultPages} hoja{resultPages !== 1 ? 's' : ''} con{' '}
              {layout} páginas por hoja.
            </p>
            <Button onClick={downloadResult} size="lg" className={accent.solid}>
              <Download className="mr-2 h-5 w-5" />
              Descargar PDF
            </Button>
            <div className="mt-6">
              <Button variant="outline" onClick={resetAll} size="lg">
                Componer otro PDF
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </ToolShell>
  );
}
