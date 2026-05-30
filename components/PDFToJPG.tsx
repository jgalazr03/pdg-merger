'use client';

import { useState, useRef, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';
import {
  FileText,
  Download,
  Loader2,
  X,
  ImageIcon,
  Images,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { cn, scrollIntoViewSafe } from '@/lib/utils';
import { toastUndo } from '@/lib/toast';
import { getTool } from '@/lib/tools';
import ToolShell from '@/components/tools/ToolShell';
import FileDropzone from '@/components/tools/FileDropzone';
import ToolConstraints from '@/components/tools/ToolConstraints';

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
}

const tool = getTool('pdf-a-jpg');
const accent = tool.accent;

type ResolutionLevel = 'normal' | 'alta' | 'maxima';

// La resolución se controla con la escala de renderizado de pdf.js (1 ≈ 96 DPI).
// Calidad JPEG fija y alta: el peso lo modula sobre todo la escala.
const RESOLUTIONS: Record<
  ResolutionLevel,
  { scale: number; quality: number; label: string; description: string }
> = {
  normal: { scale: 1, quality: 0.85, label: 'Normal', description: 'Para ver en pantalla' },
  alta: { scale: 1.5, quality: 0.9, label: 'Alta', description: 'Equilibrado' },
  maxima: { scale: 2.5, quality: 0.92, label: 'Máxima', description: 'Para imprimir' },
};

interface PageImage {
  id: string;
  pageNumber: number;
  /** Data URL para la miniatura (preview). */
  dataUrl: string;
  /** Blob para descargar. */
  blob: Blob;
}

export default function PDFToJPG() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [resolution, setResolution] = useState<ResolutionLevel>('alta');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [images, setImages] = useState<PageImage[]>([]);
  const fileInfoRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  // Al seleccionar el archivo, baja a su información.
  useEffect(() => {
    if (selectedFile && fileInfoRef.current) {
      setTimeout(() => scrollIntoViewSafe(fileInfoRef.current), 100);
    }
  }, [selectedFile]);

  // Al terminar la conversión, baja al inicio de la sección de resultado.
  useEffect(() => {
    if (images.length > 0) {
      setTimeout(() => scrollIntoViewSafe(resultRef.current), 100);
    }
  }, [images.length]);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const baseName = (): string =>
    selectedFile ? selectedFile.name.replace(/\.pdf$/i, '') : 'documento';

  const handleFileSelect = async (file: File) => {
    if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) {
      toast.error('Archivo no válido', {
        description: 'Por favor selecciona un archivo PDF.',
      });
      return;
    }

    setSelectedFile(file);
    setImages([]);
    setProgress(0);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      setTotalPages(pdf.numPages);
    } catch (error) {
      console.error('Error loading PDF:', error);
      toast.error('No se pudo cargar el PDF', {
        description: 'Asegúrate de que sea un archivo válido.',
      });
      setSelectedFile(null);
      setTotalPages(0);
    }
  };

  const convertToImages = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setProgress(0);
    const { scale, quality } = RESOLUTIONS[resolution];

    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const results: PageImage[] = [];

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d')!;
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        // JPEG no tiene canal alfa: fondo blanco para páginas transparentes.
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);

        await page.render({ canvasContext: context, viewport }).promise;

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            (b) => (b ? resolve(b) : reject(new Error('toBlob falló'))),
            'image/jpeg',
            quality
          );
        });

        results.push({
          id: `${pageNum}-${Math.random().toString(36).substring(2, 9)}`,
          pageNumber: pageNum,
          dataUrl,
          blob,
        });

        setProgress(Math.round((pageNum / pdf.numPages) * 100));
        // Cede el hilo al navegador para que la UI (barra de progreso) respire.
        await new Promise((r) => setTimeout(r, 0));
      }

      setImages(results);
      toast.success(
        `Se ${results.length === 1 ? 'generó' : 'generaron'} ${results.length} imagen${results.length !== 1 ? 'es' : ''} JPG`
      );
    } catch (error) {
      console.error('Error converting PDF:', error);
      toast.error('No se pudo convertir el PDF', {
        description: 'Inténtalo de nuevo.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadImage = (image: PageImage) => {
    const url = URL.createObjectURL(image.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${baseName()}_pagina_${image.pageNumber}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadAll = async () => {
    if (images.length === 0) return;

    if (images.length === 1) {
      downloadImage(images[0]);
      return;
    }

    const zip = new JSZip();
    images.forEach((image) => {
      zip.file(`${baseName()}_pagina_${image.pageNumber}.jpg`, image.blob);
    });

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${baseName()}_jpg.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const resetAll = () => {
    setSelectedFile(null);
    setTotalPages(0);
    setImages([]);
    setProgress(0);
  };

  // Cambiar/descartar archivo con red de seguridad: ofrece deshacer.
  const changeFileWithUndo = () => {
    if (!selectedFile) return;
    const snap = { selectedFile, totalPages, images };
    resetAll();
    toastUndo('Archivo descartado', {
      description: 'Selecciona otro PDF, o recupéralo si fue un error.',
      onUndo: () => {
        setSelectedFile(snap.selectedFile);
        setTotalPages(snap.totalPages);
        setImages(snap.images);
      },
    });
  };

  const step: 1 | 2 | 3 = !selectedFile ? 1 : images.length > 0 ? 3 : 2;

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

      {selectedFile && images.length === 0 && (
        <Card className="mb-8 motion-safe:animate-slide-up" ref={fileInfoRef}>
          <CardContent className="p-4 sm:p-6">
            {/* Encabezado + acción: apilados en móvil (el título mono envuelve
                y chocaría con el botón); en una fila a partir de sm. */}
            <div className="mb-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="font-display text-lg font-bold text-ink">
                Archivo seleccionado
              </h2>
              <Button
                variant="outline"
                size="sm"
                onClick={changeFileWithUndo}
                className="shrink-0"
                disabled={isProcessing}
              >
                <X className="mr-2 h-4 w-4" />
                Cambiar archivo
              </Button>
            </div>

            <div className="flex items-center gap-4 rounded-lg border-3 border-ink bg-surface p-3 sm:p-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded border-2 border-ink bg-card">
                <FileText className="h-6 w-6 text-ink" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink">{selectedFile.name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatFileSize(selectedFile.size)} • {totalPages} página
                  {totalPages !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            <div className="mt-6">
              <Label className="mb-3 block text-sm font-medium text-ink">
                <ImageIcon className="mr-2 inline h-4 w-4" />
                Resolución de las imágenes
              </Label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {(Object.keys(RESOLUTIONS) as ResolutionLevel[]).map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setResolution(level)}
                    aria-pressed={resolution === level}
                    className={cn(
                      'rounded-lg border-3 border-ink p-4 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2',
                      resolution === level
                        ? 'bg-indigo-soft'
                        : 'bg-surface hover:bg-muted'
                    )}
                  >
                    <div className="mb-1 font-bold text-ink">
                      {RESOLUTIONS[level].label}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {RESOLUTIONS[level].description}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className={cn('mt-6 rounded-lg border-3 border-ink p-4', accent.soft)}>
              <p className={cn('text-sm', accent.softText)}>
                <strong>Tip:</strong> se generará una imagen JPG por cada página.
                A mayor resolución, más nitidez y más peso por imagen.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedFile && images.length === 0 && (
        <Card className="mb-8">
          <CardContent className="p-4 text-center sm:p-6">
            <h2 className="mb-4 font-display text-lg font-bold text-ink">
              ¿Listo para convertir?
            </h2>
            <p className="mb-6 text-muted-foreground">
              Se generar{totalPages !== 1 ? 'án' : 'á'} {totalPages} imagen
              {totalPages !== 1 ? 'es' : ''} JPG en resolución{' '}
              {RESOLUTIONS[resolution].label.toLowerCase()}.
            </p>

            {isProcessing && (
              <div className="mx-auto mb-6 max-w-md space-y-2" aria-live="polite">
                <div className="flex items-center justify-between text-sm">
                  <span className={accent.text}>Convirtiendo páginas…</span>
                  <span className="text-muted-foreground">{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            )}

            <Button
              onClick={convertToImages}
              disabled={isProcessing}
              aria-busy={isProcessing}
              size="lg"
              className={accent.solid}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Convirtiendo…
                </>
              ) : (
                <>
                  <Images className="mr-2 h-5 w-5" />
                  Convertir a JPG
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {images.length > 0 && (
        <Card ref={resultRef} className="motion-safe:animate-slide-up">
          <CardContent className="p-4 sm:p-6">
            <div className="mb-6 text-center">
              <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full border-3 border-ink bg-success text-white">
                <Download className="h-8 w-8" />
              </div>
              <h2 className="mb-2 text-lg font-bold text-success">
                ¡Conversión completada!
              </h2>
              <p className="mb-6 text-ink">
                Se {images.length === 1 ? 'generó' : 'generaron'} {images.length}{' '}
                imagen{images.length !== 1 ? 'es' : ''} JPG.
              </p>
              <Button onClick={downloadAll} size="lg" className={accent.solid}>
                <Download className="mr-2 h-5 w-5" />
                Descargar {images.length > 1 ? 'todo (ZIP)' : 'imagen'}
              </Button>
            </div>

            {/* Rejilla de miniaturas responsive: 2 columnas en móvil → 4 en
                escritorio. Cada página es un panel del sistema. */}
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
              {images.map((image) => (
                <li
                  key={image.id}
                  className="flex flex-col overflow-hidden rounded-lg border-3 border-ink bg-surface"
                >
                  <div className="flex items-center justify-center border-b-3 border-ink bg-card p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={image.dataUrl}
                      alt={`Página ${image.pageNumber}`}
                      className="h-auto max-h-48 w-auto max-w-full"
                      loading="lazy"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2 p-2.5">
                    <span className="text-sm font-bold text-ink">
                      Página {image.pageNumber}
                    </span>
                    <Button
                      onClick={() => downloadImage(image)}
                      size="sm"
                      variant="outline"
                      className="shrink-0"
                      aria-label={`Descargar página ${image.pageNumber}`}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-6 text-center">
              <Button variant="outline" onClick={resetAll} size="lg">
                Convertir otro PDF
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </ToolShell>
  );
}
