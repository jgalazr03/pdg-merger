'use client';

import { useState, useRef, useEffect } from 'react';
import { PDFDocument } from 'pdf-lib';
import {
  FileText,
  Download,
  Loader2,
  X,
  GripVertical,
  Edit3,
  Image as ImageIcon,
  Crop,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { getTool } from '@/lib/tools';
import ToolShell from '@/components/tools/ToolShell';
import FileDropzone from '@/components/tools/FileDropzone';
import ImageCropModal, { CropResult } from '@/components/ImageCropModal';

const tool = getTool('unir');
const accent = tool.accent;

interface PDFFile {
  id: string;
  file: File;
  name: string;
  size: string;
  type: 'pdf' | 'image';
  cropped?: CropResult;
}

export default function PDFMerger() {
  const [files, setFiles] = useState<PDFFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [fileName, setFileName] = useState('');
  const [fileNameError, setFileNameError] = useState('');
  const [cropFileId, setCropFileId] = useState<string | null>(null);
  const filesListRef = useRef<HTMLDivElement>(null);

  // Auto-scroll when files are added
  useEffect(() => {
    if (files.length > 0 && filesListRef.current) {
      setTimeout(() => {
        filesListRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }, 100);
    }
  }, [files.length]);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const validateFileName = (name: string): boolean => {
    if (!name.trim()) return true; // Empty is allowed, will use default

    // Check for invalid characters
    const invalidChars = /[\/\\:*?"<>|]/;
    if (invalidChars.test(name)) {
      setFileNameError('El nombre no puede contener los caracteres: / \\ : * ? " < > |');
      return false;
    }

    // Check for reserved names on Windows
    const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
    if (reservedNames.includes(name.toUpperCase())) {
      setFileNameError('Este nombre está reservado por el sistema');
      return false;
    }

    // Check length
    if (name.length > 200) {
      setFileNameError('El nombre es demasiado largo (máximo 200 caracteres)');
      return false;
    }

    setFileNameError('');
    return true;
  };

  const handleFileNameChange = (value: string) => {
    setFileName(value);
    validateFileName(value);
  };

  const getValidFileName = (): string => {
    const trimmedName = fileName.trim();
    return trimmedName || 'documento_final';
  };

  const isPdfFile = (file: File): boolean =>
    file.type === 'application/pdf' || /\.pdf$/i.test(file.name);

  const isImageFile = (file: File): boolean =>
    file.type === 'image/jpeg' ||
    file.type === 'image/png' ||
    /\.(jpe?g|png)$/i.test(file.name);

  const handleFileSelect = (selectedFiles: FileList) => {
    const incoming = Array.from(selectedFiles);
    const rejected = incoming.filter(
      (file) => !isPdfFile(file) && !isImageFile(file)
    );
    const newFiles = incoming
      .filter((file) => isPdfFile(file) || isImageFile(file))
      .map((file) => ({
        id: Math.random().toString(36).substring(2, 15),
        file,
        name: file.name.replace(/\.(pdf|jpe?g|png)$/i, ''),
        size: formatFileSize(file.size),
        type: isPdfFile(file) ? ('pdf' as const) : ('image' as const),
      }));

    if (rejected.length > 0) {
      toast.error('Algunos archivos no son válidos', {
        description: 'Solo se aceptan archivos PDF e imágenes JPG o PNG.',
      });
    }

    if (newFiles.length > 0) {
      setFiles((prev) => [...prev, ...newFiles]);
      toast.success(
        `${newFiles.length} archivo${newFiles.length !== 1 ? 's' : ''} agregado${newFiles.length !== 1 ? 's' : ''}`
      );
    }
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((file) => file.id !== id));
  };

  // Convierte un data URL (base64) en bytes para embeber en el PDF
  const dataUrlToBytes = (dataUrl: string): Uint8Array => {
    const base64 = dataUrl.split(',')[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  };

  const handleCropConfirm = (result: CropResult) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === cropFileId ? { ...f, cropped: result } : f))
    );
    setCropFileId(null);
  };

  const fileToCrop = files.find((f) => f.id === cropFileId);

  // Reordenamiento por arrastre
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null) return;
    moveFile(draggedIndex, dropIndex);
    setDraggedIndex(null);
  };

  // Reordenamiento accesible por teclado
  const moveFile = (from: number, to: number) => {
    if (to < 0 || to >= files.length || from === to) return;
    const newFiles = [...files];
    const [moved] = newFiles.splice(from, 1);
    newFiles.splice(to, 0, moved);
    setFiles(newFiles);
  };

  const mergePDFs = async () => {
    if (files.length < 1) return;
    if (!validateFileName(fileName)) return;

    setIsProcessing(true);
    try {
      const mergedPdf = await PDFDocument.create();

      // Dimensiones de una página tamaño Carta (Letter) en puntos
      const LETTER_SHORT = 612;
      const LETTER_LONG = 792;

      for (const pdfFile of files) {
        if (pdfFile.type === 'image' && pdfFile.cropped) {
          // Imagen recortada: se coloca centrada en una hoja Carta auto-orientada
          const bytes = dataUrlToBytes(pdfFile.cropped.dataUrl);
          const image = await mergedPdf.embedJpg(bytes);

          // Orientar la hoja Carta según la proporción de la imagen recortada
          const landscape = pdfFile.cropped.width > pdfFile.cropped.height;
          const pageWidth = landscape ? LETTER_LONG : LETTER_SHORT;
          const pageHeight = landscape ? LETTER_SHORT : LETTER_LONG;

          const page = mergedPdf.addPage([pageWidth, pageHeight]);
          const scaled = image.scaleToFit(pageWidth, pageHeight);
          page.drawImage(image, {
            x: (pageWidth - scaled.width) / 2,
            y: (pageHeight - scaled.height) / 2,
            width: scaled.width,
            height: scaled.height,
          });
        } else if (pdfFile.type === 'image') {
          // Imagen sin recortar: página del tamaño exacto de la imagen (sin bordes)
          const arrayBuffer = await pdfFile.file.arrayBuffer();
          const isPng =
            pdfFile.file.type === 'image/png' || /\.png$/i.test(pdfFile.file.name);
          const image = isPng
            ? await mergedPdf.embedPng(arrayBuffer)
            : await mergedPdf.embedJpg(arrayBuffer);

          const page = mergedPdf.addPage([image.width, image.height]);
          page.drawImage(image, {
            x: 0,
            y: 0,
            width: image.width,
            height: image.height,
          });
        } else {
          const arrayBuffer = await pdfFile.file.arrayBuffer();
          const pdf = await PDFDocument.load(arrayBuffer);
          const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
          copiedPages.forEach((page) => mergedPdf.addPage(page));
        }
      }

      const pdfBytes = await mergedPdf.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      toast.success('¡PDF generado correctamente!');
    } catch (error) {
      console.error('Error merging PDFs:', error);
      toast.error('No se pudo generar el PDF', {
        description: 'Revisa los archivos e inténtalo de nuevo.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadMergedPDF = () => {
    if (!downloadUrl) return;

    const finalFileName = `${getValidFileName()}.pdf`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = finalFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const resetAll = () => {
    setFiles([]);
    setDownloadUrl(null);
    setFileName('');
    setFileNameError('');
  };

  const step: 1 | 2 | 3 = files.length === 0 ? 1 : downloadUrl ? 3 : 2;

  return (
    <ToolShell tool={tool} step={step}>
      <Card className="mb-8">
        <CardContent className="p-6 sm:p-8">
          <FileDropzone
            accent={accent}
            multiple
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            idleTitle="Selecciona archivos PDF o imágenes"
            idleSubtitle="Haz clic aquí o arrastra y suelta tus archivos PDF o imágenes (JPG, PNG)"
            dragTitle="Suelta los archivos aquí"
            buttonLabel="Seleccionar archivos"
            ariaLabel="Seleccionar o arrastrar archivos PDF o imágenes"
            onFiles={handleFileSelect}
          />
        </CardContent>
      </Card>

      {files.length > 0 && (
        <Card className="mb-8 motion-safe:animate-slide-up" ref={filesListRef}>
          <CardContent className="p-6">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Archivos seleccionados ({files.length})
              </h2>
              <Button variant="outline" size="sm" onClick={resetAll}>
                <X className="mr-2 h-4 w-4" />
                Limpiar todo
              </Button>
            </div>

            <ul className="space-y-3">
              {files.map((file, index) => (
                <li
                  key={file.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, index)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border-2 border-transparent bg-gray-50 p-4 transition-all hover:bg-gray-100',
                    draggedIndex === index && 'opacity-50 motion-safe:scale-95'
                  )}
                >
                  <GripVertical
                    className="hidden h-5 w-5 shrink-0 cursor-move text-gray-400 sm:block"
                    aria-hidden="true"
                  />

                  {/* Controles de orden accesibles por teclado */}
                  <div className="flex shrink-0 flex-col">
                    <button
                      type="button"
                      onClick={() => moveFile(index, index - 1)}
                      disabled={index === 0}
                      aria-label={`Mover ${file.name} hacia arriba`}
                      className={cn(
                        'rounded p-0.5 text-gray-400 transition-colors hover:text-gray-700 disabled:opacity-30 disabled:hover:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
                        accent.ring
                      )}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveFile(index, index + 1)}
                      disabled={index === files.length - 1}
                      aria-label={`Mover ${file.name} hacia abajo`}
                      className={cn(
                        'rounded p-0.5 text-gray-400 transition-colors hover:text-gray-700 disabled:opacity-30 disabled:hover:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
                        accent.ring
                      )}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex flex-1 items-center gap-3">
                    <div
                      className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded',
                        file.type === 'image' ? accent.iconBg : 'bg-red-100'
                      )}
                    >
                      {file.type === 'image' ? (
                        <ImageIcon className={cn('h-5 w-5', accent.text)} />
                      ) : (
                        <FileText className="h-5 w-5 text-red-600" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-gray-900">
                        {file.name}
                      </p>
                      <p className="text-sm text-gray-500">
                        {file.size}
                        {file.cropped && (
                          <span className="ml-2 inline-flex items-center text-green-600">
                            <Crop className="mr-1 h-3 w-3" />
                            Recortado
                          </span>
                        )}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm text-gray-400">
                      #{index + 1}
                    </span>
                  </div>

                  {file.type === 'image' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCropFileId(file.id)}
                      className={cn('shrink-0', accent.text)}
                      title="Recortar imagen"
                    >
                      <Crop className="mr-2 h-4 w-4" />
                      {file.cropped ? 'Reajustar' : 'Recortar'}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(file.id)}
                    aria-label={`Quitar ${file.name}`}
                    className="shrink-0 text-gray-400 hover:text-red-600"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>

            <div className={cn('mt-6 rounded-lg p-4', accent.soft)}>
              <p className={cn('text-sm', accent.softText)}>
                <strong>Tip:</strong> arrastra los archivos (o usa las flechas) para
                cambiar el orden. Se unirán en el orden que aparecen aquí. Usa el
                ícono de recorte en las imágenes para ajustarlas a tamaño Carta.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {files.length >= 1 && !downloadUrl && (
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="mb-6 text-center">
              <h2 className="mb-2 text-lg font-semibold text-gray-900">
                {files.length > 1 ? '¿Listo para unir?' : '¿Listo para generar el PDF?'}
              </h2>
              <p className="text-gray-600">
                {files.length > 1
                  ? `Se unirán ${files.length} archivos en un solo documento PDF.`
                  : 'Se generará un documento PDF a partir de tu archivo.'}
              </p>
            </div>

            <div className="mx-auto mb-6 max-w-md">
              <Label
                htmlFor="filename"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                <Edit3 className="mr-2 inline h-4 w-4" />
                Nombre del archivo final
              </Label>
              <div className="relative">
                <Input
                  id="filename"
                  type="text"
                  placeholder="documento_final"
                  value={fileName}
                  onChange={(e) => handleFileNameChange(e.target.value)}
                  aria-invalid={!!fileNameError}
                  aria-describedby="filename-help"
                  className={cn(
                    'pr-12',
                    fileNameError && 'border-red-300 focus-visible:ring-red-200'
                  )}
                />
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                  <span className="text-sm text-gray-500">.pdf</span>
                </div>
              </div>
              {fileNameError ? (
                <p className="mt-2 text-sm text-red-600" id="filename-help">
                  {fileNameError}
                </p>
              ) : (
                <p className="mt-2 text-xs text-gray-500" id="filename-help">
                  Si lo dejas vacío, se usará &quot;documento_final.pdf&quot;
                </p>
              )}
            </div>

            <div className="text-center">
              <Button
                onClick={mergePDFs}
                disabled={isProcessing || !!fileNameError}
                aria-busy={isProcessing}
                size="lg"
                className={accent.solid}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Procesando…
                  </>
                ) : (
                  <>
                    <FileText className="mr-2 h-5 w-5" />
                    {files.length > 1 ? 'Unir archivos' : 'Generar PDF'}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {downloadUrl && (
        <Card className="border-green-200 bg-green-50 motion-safe:animate-slide-up">
          <CardContent className="p-6 text-center">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <Download className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="mb-2 text-lg font-semibold text-green-900">¡Listo!</h2>
            <p className="mb-6 text-green-800">
              Tu PDF unificado está listo para descargar como &quot;
              {getValidFileName()}.pdf&quot;
            </p>
            <div className="flex flex-col justify-center gap-3 sm:flex-row">
              <Button
                onClick={downloadMergedPDF}
                size="lg"
                className="bg-green-600 text-white hover:bg-green-700"
              >
                <Download className="mr-2 h-5 w-5" />
                Descargar {getValidFileName()}.pdf
              </Button>
              <Button variant="outline" onClick={resetAll} size="lg">
                Crear otro PDF
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {fileToCrop && (
        <ImageCropModal
          file={fileToCrop.file}
          onCancel={() => setCropFileId(null)}
          onConfirm={handleCropConfirm}
        />
      )}
    </ToolShell>
  );
}
