'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';
import ExcelJS from 'exceljs';
import { FileText, Download, Loader2, X, Minimize2 as Compress, AlertCircle, FileSpreadsheet, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { performanceMonitor } from '@/lib/performance-monitor';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, scrollIntoViewSafe } from '@/lib/utils';
import { toastUndo } from '@/lib/toast';
import { getTool } from '@/lib/tools';
import ToolShell from '@/components/tools/ToolShell';
import FileDropzone from '@/components/tools/FileDropzone';

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
}

interface ProcessableFile {
  id: string;
  file: File;
  name: string;
  originalSize: number;
  compressedSize?: number;
  compressedBlob?: Blob;
  preview?: string;
  isProcessing: boolean;
  error?: string;
  type: 'pdf' | 'excel';
  progress?: number; // Progress percentage for large files
  estimatedTime?: string; // Estimated time remaining
}

type CompressionLevel = 'low' | 'medium' | 'high';

const compressionSettings = {
  low: { scale: 0.9, quality: 0.85, description: 'Mejor calidad, menor reducción' },
  medium: { scale: 0.7, quality: 0.6, description: 'Equilibrado' },
  high: { scale: 0.5, quality: 0.4, description: 'Menor calidad, mayor reducción' }
};

const tool = getTool('comprimir');
const accent = tool.accent;

/**
 * PDFCompressor Component - Now supports PDF and Excel file compression
 * 
 * Features:
 * - PDF compression: Full document compression with configurable quality
 * - Excel compression: Embedded images compression without affecting data
 * - Drag & drop interface
 * - Multiple compression levels (low, medium, high)
 * - Batch processing
 * - ZIP download for multiple files
 * - Client-side processing (no server uploads)
 * 
 * Supported formats:
 * - PDF (.pdf)
 * - Excel (.xlsx, .xls)
 */
export default function PDFCompressor() {
  const [files, setFiles] = useState<ProcessableFile[]>([]);
  const [compressionLevel, setCompressionLevel] = useState<CompressionLevel>('medium');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const filesListRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  // Al agregar archivos, baja a la lista.
  useEffect(() => {
    if (files.length > 0 && filesListRef.current) {
      setTimeout(() => scrollIntoViewSafe(filesListRef.current), 100);
    }
  }, [files.length]);

  // Al terminar de comprimir todos, baja al inicio de la sección de resultado.
  useEffect(() => {
    if (files.length > 0 && files.every((f) => f.compressedBlob)) {
      setTimeout(() => scrollIntoViewSafe(resultRef.current), 100);
    }
  }, [files]);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const calculateReduction = (original: number, compressed: number): number => {
    return Math.round(((original - compressed) / original) * 100);
  };

  const validateFiles = (selectedFiles: FileList): File[] => {
    const validFiles: File[] = [];
    const maxTotalSize = 500 * 1024 * 1024; // 500MB
    let totalSize = files.reduce((sum, file) => sum + file.originalSize, 0);

    for (const file of Array.from(selectedFiles)) {
      // Validate file type (PDF or Excel)
      const isPDF = file.type === 'application/pdf';
      const isExcel = file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
                     file.type === 'application/vnd.ms-excel' ||
                     file.name.toLowerCase().endsWith('.xlsx') ||
                     file.name.toLowerCase().endsWith('.xls');
      
      if (!isPDF && !isExcel) {
        toast.error('Archivo no válido', {
          description: `"${file.name}" no es un PDF ni un Excel válido.`,
        });
        continue;
      }

      // Check for duplicates
      if (files.some(existingFile => existingFile.name === file.name && existingFile.originalSize === file.size)) {
        toast.error('Archivo duplicado', {
          description: `"${file.name}" ya está en la lista.`,
        });
        continue;
      }

      // Check total size limit
      if (totalSize + file.size > maxTotalSize) {
        toast.error('Límite de tamaño excedido', {
          description: 'El tamaño total de archivos no puede superar 500MB.',
        });
        break;
      }

      totalSize += file.size;
      validFiles.push(file);
    }

    return validFiles;
  };

  const generatePreview = async (file: File): Promise<string | undefined> => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const page = await pdf.getPage(1);
      
      const viewport = page.getViewport({ scale: 0.3 });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d')!;
      
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise;
      
      return canvas.toDataURL('image/jpeg', 0.8);
    } catch (error) {
      console.error('Error generating preview:', error);
      return undefined;
    }
  };

  const handleFileSelect = async (selectedFiles: FileList) => {
    const validFiles = validateFiles(selectedFiles);
    if (validFiles.length === 0) return;

    setIsLoadingFiles(true);
    try {
      const newFiles: ProcessableFile[] = await Promise.all(
        validFiles.map(async (file) => {
          const fileType = file.type === 'application/pdf' ? 'pdf' : 'excel';
          const preview = fileType === 'pdf' ? await generatePreview(file) : undefined;
          const fileName = file.name.replace(/\.(pdf|xlsx|xls)$/i, '');

          return {
            id: Math.random().toString(36).substring(2, 15),
            file,
            name: fileName,
            originalSize: file.size,
            preview,
            isProcessing: false,
            type: fileType,
          };
        })
      );

      setFiles(prev => [...prev, ...newFiles]);
      toast.success(
        `${newFiles.length} archivo${newFiles.length !== 1 ? 's' : ''} agregado${newFiles.length !== 1 ? 's' : ''}`
      );
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(file => file.id !== id));
  };

  const compressPDF = async (pdfFile: ProcessableFile): Promise<Blob> => {
    const { scale, quality } = compressionSettings[compressionLevel];
    
    // Load PDF with PDF.js
    const arrayBuffer = await pdfFile.file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    // Create new PDF with pdf-lib
    const newPdf = await PDFDocument.create();
    
    // Process each page
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      
      // Create canvas and render page
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d')!;
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise;
      
      // Convert to compressed image
      const imageDataUrl = canvas.toDataURL('image/jpeg', quality);
      const imageBytes = Uint8Array.from(atob(imageDataUrl.split(',')[1]), c => c.charCodeAt(0));
      
      // Add image to new PDF
      const image = await newPdf.embedJpg(imageBytes);
      const pdfPage = newPdf.addPage([viewport.width, viewport.height]);
      pdfPage.drawImage(image, {
        x: 0,
        y: 0,
        width: viewport.width,
        height: viewport.height,
      });
    }
    
    const pdfBytes = await newPdf.save();
    return new Blob([pdfBytes], { type: 'application/pdf' });
  };

  /**
   * Excel compression with progress updates for large files
   * Updates UI with progress percentage and estimated time
   */
  const compressExcelWithProgress = async (excelFile: ProcessableFile): Promise<Blob> => {
    const { quality, scale } = compressionSettings[compressionLevel];
    const BATCH_SIZE = 8; // Reduced batch size for better progress tracking
    const MIN_IMAGE_SIZE = 30 * 1024; // 30KB threshold
    
    try {
      // Load the Excel file
      const arrayBuffer = await excelFile.file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(arrayBuffer);

      // Collect all processable images
      const allImages: Array<{
        worksheet: any;
        image: any;
        imageModel: any;
        mediaIndex: number;
      }> = [];

      for (const worksheet of workbook.worksheets) {
        const images = worksheet.getImages();
        
        for (const image of images) {
          const imageModel = workbook.model.media.find(m => m.name === image.imageId);
          if (imageModel && imageModel.buffer && imageModel.buffer.byteLength > MIN_IMAGE_SIZE) {
            const mediaIndex = workbook.model.media.findIndex(m => m.name === image.imageId);
            allImages.push({
              worksheet,
              image,
              imageModel,
              mediaIndex
            });
          }
        }
      }

      if (allImages.length === 0) {
        // No images to compress, return original
        return new Blob([arrayBuffer], { 
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
        });
      }

      let processedImages = 0;

      // Process images in batches with progress updates
      for (let i = 0; i < allImages.length; i += BATCH_SIZE) {
        const batch = allImages.slice(i, i + BATCH_SIZE);
        const progressPercent = Math.round((processedImages / allImages.length) * 100);
        
        // Update progress in UI
        setFiles(prev => prev.map(f => 
          f.id === excelFile.id ? { 
            ...f, 
            progress: progressPercent,
            estimatedTime: progressPercent > 10 ? 
              `${Math.ceil(((100 - progressPercent) / progressPercent) * 2)} min` : 
              'Calculando…'
          } : f
        ));
        
        // Process batch with controlled concurrency
        const compressionPromises = batch.map(async ({ imageModel, mediaIndex }) => {
          try {
            const originalSize = imageModel.buffer.byteLength;

            // Skip very large images that might cause memory issues
            if (originalSize > 50 * 1024 * 1024) { // 50MB threshold
              console.warn(`Skipping very large image (${Math.round(originalSize / (1024 * 1024))}MB)`);
              return;
            }

            const compressedBuffer = await compressImageBufferOptimized(
              new Uint8Array(imageModel.buffer),
              quality,
              scale
            );

            // Only replace if compression provides significant benefit
            const compressionRatio = compressedBuffer.byteLength / originalSize;
            if (compressionRatio < 0.85) { // At least 15% reduction
              const nodeBuffer = Buffer.from ? Buffer.from(compressedBuffer) : new (Buffer as any)(compressedBuffer);
              (workbook.model.media[mediaIndex] as any).buffer = nodeBuffer;
            }
          } catch (error) {
            console.warn(`Failed to compress image at index ${mediaIndex}:`, error);
          }
        });

        await Promise.all(compressionPromises);
        processedImages += batch.length;

        // Yield control back to the browser to prevent freezing
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Memory cleanup hint
        if (typeof global !== 'undefined' && global.gc) {
          global.gc();
        }
      }

      // Final progress update
      setFiles(prev => prev.map(f => 
        f.id === excelFile.id ? { 
          ...f, 
          progress: 95,
          estimatedTime: 'Finalizando…'
        } : f
      ));

      // Save the modified workbook
      const buffer = await workbook.xlsx.writeBuffer();
      return new Blob([buffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
    } catch (error) {
      console.error('Error compressing Excel file:', error);
      throw new Error(`Error al comprimir el archivo Excel: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  };

  /**
   * Optimized image compression with better memory management and performance
   * Uses OffscreenCanvas when available for better performance
   * 
   * @param imageBuffer - Original image as Uint8Array
   * @param quality - JPEG quality (0-1)
   * @param scale - Scale factor for dimensions
   * @returns Promise<Uint8Array> - Compressed image buffer
   */
  const compressImageBufferOptimized = async (
    imageBuffer: Uint8Array, 
    quality: number, 
    scale: number
  ): Promise<Uint8Array> => {
    return new Promise((resolve, reject) => {
      try {
        // Create blob URL for the image
        const blob = new Blob([imageBuffer]);
        const imageUrl = URL.createObjectURL(blob);
        
        const img = document.createElement('img');
        
        img.onload = () => {
          try {
            // Use OffscreenCanvas for better performance if available
            const useOffscreen = typeof OffscreenCanvas !== 'undefined';
            
            if (useOffscreen) {
              const canvas = new OffscreenCanvas(
                Math.floor(img.width * scale),
                Math.floor(img.height * scale)
              );
              const ctx = canvas.getContext('2d')!;
              
              // Set image smoothing for better quality
              ctx.imageSmoothingEnabled = true;
              ctx.imageSmoothingQuality = 'high';
              
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
              
              canvas.convertToBlob({ 
                type: 'image/jpeg', 
                quality: quality 
              }).then(blob => {
                blob.arrayBuffer().then(arrayBuffer => {
                  URL.revokeObjectURL(imageUrl);
                  resolve(new Uint8Array(arrayBuffer));
                }).catch(reject);
              }).catch(reject);
            } else {
              // Fallback to regular canvas
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d')!;
              
              canvas.width = Math.floor(img.width * scale);
              canvas.height = Math.floor(img.height * scale);
              
              // Set image smoothing for better quality
              ctx.imageSmoothingEnabled = true;
              ctx.imageSmoothingQuality = 'high';
              
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
              
              canvas.toBlob((blob) => {
                if (blob) {
                  blob.arrayBuffer().then(arrayBuffer => {
                    URL.revokeObjectURL(imageUrl);
                    resolve(new Uint8Array(arrayBuffer));
                  }).catch(reject);
                } else {
                  URL.revokeObjectURL(imageUrl);
                  reject(new Error('Failed to create blob'));
                }
              }, 'image/jpeg', quality);
            }
          } catch (error) {
            URL.revokeObjectURL(imageUrl);
            reject(error);
          }
        };
        
        img.onerror = () => {
          URL.revokeObjectURL(imageUrl);
          reject(new Error('Failed to load image'));
        };
        
        img.src = imageUrl;
      } catch (error) {
        reject(error);
      }
    });
  };

  const compressFiles = async () => {
    setIsProcessing(true);
    const startTime = Date.now();
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.compressedBlob) continue; // Skip already compressed
      
      // Estimate time remaining
      const avgTimePerFile = i > 0 ? (Date.now() - startTime) / i : 0;
      const remainingFiles = files.length - i;
      const estimatedTime = avgTimePerFile > 0 ? 
        `${Math.ceil((avgTimePerFile * remainingFiles) / 60000)} min` : 
        'Calculando…';
      
      setFiles(prev => prev.map(f => 
        f.id === file.id ? { 
          ...f, 
          isProcessing: true, 
          error: undefined,
          progress: 0,
          estimatedTime 
        } : f
      ));

      // Telemetría local (PDF y Excel se procesan en el navegador)
      performanceMonitor.startMonitoring(file.id, file.name, file.originalSize, 'main-thread');

      try {
        let compressedBlob: Blob;
        if (file.type === 'pdf') {
          compressedBlob = await compressPDF(file);
        } else if (file.type === 'excel') {
          // Compresión 100% en el navegador (imágenes embebidas, sin subir el archivo)
          compressedBlob = await compressExcelWithProgress(file);
        } else {
          throw new Error('Tipo de archivo no soportado');
        }

        // Si comprimir no reduce el tamaño (p. ej. un PDF ya optimizado o un
        // escaneo ya comprimido), conservamos el original para no entregar un
        // archivo más grande. En ese caso la reducción queda en 0 %.
        const bestBlob =
          compressedBlob.size < file.originalSize ? compressedBlob : file.file;

        successCount++;
        setFiles(prev => prev.map(f =>
          f.id === file.id ? {
            ...f,
            compressedBlob: bestBlob,
            compressedSize: bestBlob.size,
            isProcessing: false,
            progress: 100,
            estimatedTime: undefined
          } : f
        ));

        // Record performance metrics
        performanceMonitor.finishMonitoring(file.id, bestBlob.size);
      } catch (error) {
        console.error('Error compressing file:', error);
        errorCount++;

        // Record error in performance monitoring
        performanceMonitor.recordError(file.id, error instanceof Error ? error.message : 'Unknown error');
        performanceMonitor.finishMonitoring(file.id);

        setFiles(prev => prev.map(f =>
          f.id === file.id ? {
            ...f,
            isProcessing: false,
            error: 'Error al comprimir el archivo',
            progress: undefined,
            estimatedTime: undefined
          } : f
        ));
      }
    }

    setIsProcessing(false);

    if (successCount > 0) {
      toast.success(
        `${successCount} archivo${successCount !== 1 ? 's' : ''} comprimido${successCount !== 1 ? 's' : ''}`,
        errorCount > 0
          ? { description: `${errorCount} no se pudo comprimir.` }
          : undefined
      );
    } else if (errorCount > 0) {
      toast.error('No se pudo comprimir', {
        description: 'Revisa los archivos e inténtalo de nuevo.',
      });
    }
  };

  const downloadFile = (file: ProcessableFile) => {
    if (!file.compressedBlob) return;
    
    const url = URL.createObjectURL(file.compressedBlob);
    const link = document.createElement('a');
    link.href = url;
    
    // Set appropriate file extension based on type
    const extension = file.type === 'pdf' ? '.pdf' : '.xlsx';
    link.download = `${file.name}_comprimido${extension}`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadAllFiles = async () => {
    const compressedFiles = files.filter(f => f.compressedBlob);
    if (compressedFiles.length === 0) return;

    if (compressedFiles.length === 1) {
      downloadFile(compressedFiles[0]);
      return;
    }

    // Create ZIP file
    const zip = new JSZip();
    
    compressedFiles.forEach(file => {
      if (file.compressedBlob) {
        const extension = file.type === 'pdf' ? '.pdf' : '.xlsx';
        zip.file(`${file.name}_comprimido${extension}`, file.compressedBlob);
      }
    });
    
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'archivos_comprimidos.zip';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const resetAll = () => {
    setFiles([]);
  };

  // Acción destructiva con red de seguridad: vacía la lista pero ofrece deshacer.
  const clearAll = () => {
    if (files.length === 0) return;
    const snapshot = files;
    const count = files.length;
    setFiles([]);
    toastUndo('Lista vaciada', {
      description: `Se ${count === 1 ? 'quitó' : 'quitaron'} ${count} archivo${count !== 1 ? 's' : ''}.`,
      onUndo: () => setFiles(snapshot),
    });
  };

  const totalOriginalSize = files.reduce((sum, file) => sum + file.originalSize, 0);
  const totalCompressedSize = files.reduce((sum, file) => sum + (file.compressedSize || 0), 0);
  const compressedFilesCount = files.filter(f => f.compressedBlob).length;
  const totalReduction =
    totalCompressedSize > 0 ? calculateReduction(totalOriginalSize, totalCompressedSize) : 0;
  const reduced = totalReduction > 0;
  // Todos los archivos de la lista ya tienen resultado: la herramienta llegó al
  // paso "Listo" y la tarjeta de acción pasa a un estado de finalización.
  const allCompressed = files.length > 0 && compressedFilesCount === files.length;

  const step: 1 | 2 | 3 =
    files.length === 0 ? 1 : compressedFilesCount > 0 ? 3 : 2;

  return (
    <ToolShell tool={tool} step={step}>
      <FileDropzone
        className="mb-4"
        accent={accent}
        multiple
        accept=".pdf,.xlsx,.xls,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        idleTitle="Selecciona archivos PDF o Excel"
        idleSubtitle="Haz clic aquí o arrastra y suelta tus archivos PDF (.pdf) o Excel (.xlsx, .xls)"
        dragTitle="Suelta los archivos aquí"
        buttonLabel="Seleccionar archivos"
        ariaLabel="Seleccionar o arrastrar archivos PDF o Excel"
        onFiles={handleFileSelect}
      />

      <div className="mb-8 rounded-xl border border-warning/30 bg-warning/[0.08] p-4">
        <div className="flex items-start gap-2">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-warning" />
          <div className="text-sm text-warning-foreground">
            <p className="mb-1 font-medium">Límites y consideraciones:</p>
            <ul className="space-y-1">
              <li>• Tamaño máximo total: 500MB</li>
              <li>• Archivos PDF (.pdf) y Excel (.xlsx, .xls) válidos</li>
              <li>• No se permiten archivos duplicados</li>
              <li>• Para Excel: comprime imágenes embebidas sin afectar datos</li>
              <li>• Archivos grandes (&gt;100MB) pueden tardar varios minutos</li>
              <li>• Todo se procesa en tu navegador, por lotes para no bloquear la pantalla</li>
            </ul>
          </div>
        </div>
      </div>

      {isLoadingFiles && (
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <Skeleton className="h-20 w-16 rounded" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              Preparando archivos y generando vistas previas…
            </p>
          </CardContent>
        </Card>
      )}

      {files.length > 0 && (
        <Card className="mb-8" ref={filesListRef}>
          <CardContent className="p-6">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-brand-navy">
                Archivos seleccionados ({files.length})
              </h2>
              <Button
                variant="outline"
                size="sm"
                onClick={clearAll}
              >
                <X className="w-4 h-4 mr-2" />
                Limpiar todo
              </Button>
            </div>

            <div className="mb-6">
              <Label className="mb-3 block text-sm font-medium text-ink">
                <Compress className="mr-2 inline h-4 w-4" />
                Nivel de compresión
              </Label>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {Object.entries(compressionSettings).map(([level, settings]) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setCompressionLevel(level as CompressionLevel)}
                    aria-pressed={compressionLevel === level}
                    className={cn(
                      'rounded-lg border-2 p-4 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red focus-visible:ring-offset-2',
                      compressionLevel === level
                        ? 'border-brand-red bg-brand-red/[0.04]'
                        : 'border-border hover:border-brand-red/40'
                    )}
                  >
                    <div className="mb-1 font-medium capitalize text-ink">
                      {level === 'low' ? 'Baja' : level === 'medium' ? 'Media' : 'Alta'}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {settings.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>
            
            <div className="space-y-4">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center gap-4 rounded-lg bg-muted/50 p-4"
                >
                  {file.preview ? (
                    <Image
                      src={file.preview}
                      alt={`Vista previa de ${file.name}`}
                      width={64}
                      height={80}
                      className="w-16 h-20 object-cover rounded border"
                    />
                  ) : (
                    <div className="flex items-center justify-center w-16 h-20 bg-muted rounded border">
                      {file.type === 'pdf' ? (
                        <FileText className="w-8 h-8 text-brand-navy" />
                      ) : (
                        <FileSpreadsheet className="w-8 h-8 text-brand-navy" />
                      )}
                    </div>
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-ink truncate">
                      {file.name}
                    </p>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>Original: {formatFileSize(file.originalSize)}</p>
                      {file.compressedSize !== undefined &&
                        (calculateReduction(file.originalSize, file.compressedSize) > 0 ? (
                          <p className="text-success">
                            Comprimido: {formatFileSize(file.compressedSize)} (
                            {calculateReduction(file.originalSize, file.compressedSize)}% reducción)
                          </p>
                        ) : (
                          <p className="text-muted-foreground">
                            Ya estaba optimizado · se conserva el original
                          </p>
                        ))}
                      {file.isProcessing && file.progress !== undefined && (
                        <div className="space-y-2" aria-live="polite">
                          <div className="flex items-center justify-between text-xs">
                            <span className={accent.text}>Progreso: {file.progress}%</span>
                            {file.estimatedTime && (
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {file.estimatedTime}
                              </span>
                            )}
                          </div>
                          <Progress value={file.progress} className="h-2" />
                        </div>
                      )}
                      {file.error && (
                        <p className="text-brand-red">{file.error}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {file.isProcessing && (
                      <Loader2 className={cn('h-5 w-5 animate-spin', accent.text)} />
                    )}
                    {file.compressedBlob && (
                      <Button
                        onClick={() => downloadFile(file)}
                        size="sm"
                        variant="outline"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Descargar
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(file.id)}
                      aria-label={`Quitar ${file.name}`}
                      className="text-muted-foreground hover:text-brand-red"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {totalOriginalSize > 0 && (
              <div className="mt-6 rounded-lg bg-muted/60 p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Tamaño original total</p>
                    <p className="text-lg font-bold text-ink">{formatFileSize(totalOriginalSize)}</p>
                  </div>
                  {totalCompressedSize > 0 && (
                    <>
                      <div>
                        <p className={cn('text-sm font-medium', reduced ? 'text-success' : 'text-muted-foreground')}>
                          Tamaño final total
                        </p>
                        <p className={cn('text-lg font-bold', reduced ? 'text-success' : 'text-ink')}>
                          {formatFileSize(totalCompressedSize)}
                        </p>
                      </div>
                      <div>
                        <p className={cn('text-sm font-medium', reduced ? 'text-success' : 'text-muted-foreground')}>
                          Reducción total
                        </p>
                        <p className={cn('text-lg font-bold', reduced ? 'text-success' : 'text-ink')}>
                          {totalReduction}%
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {files.length > 0 && !allCompressed && (
        <Card className="mb-8">
          <CardContent className="p-6 text-center">
            <h2 className="mb-4 font-display text-lg font-bold text-brand-navy">
              ¿Listo para comprimir?
            </h2>
            <p className="mb-6 text-muted-foreground">
              Se comprimir{files.length !== 1 ? 'án' : 'á'} {files.length} archivo{files.length !== 1 ? 's' : ''} con nivel de compresión {
                compressionLevel === 'low' ? 'bajo' :
                compressionLevel === 'medium' ? 'medio' : 'alto'
              }.
            </p>
            <div className="text-center">
              <Button
                onClick={compressFiles}
                disabled={isProcessing}
                aria-busy={isProcessing}
                size="lg"
                className={accent.solid}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Comprimiendo…
                  </>
                ) : (
                  <>
                    <Compress className="mr-2 h-5 w-5" />
                    Comprimir archivos
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {allCompressed && (
        <Card
          ref={resultRef}
          className="border-success/20 bg-success/[0.06] motion-safe:animate-slide-up"
        >
          <CardContent className="p-6 text-center">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
              <Download className="h-8 w-8 text-success" />
            </div>
            <h2 className="mb-2 font-display text-lg font-bold text-success">
              ¡Compresión completada!
            </h2>
            <p className="mb-6 text-success/90">
              {reduced
                ? `Se ${compressedFilesCount === 1 ? 'redujo' : 'redujeron'} ${compressedFilesCount} archivo${compressedFilesCount !== 1 ? 's' : ''} un ${totalReduction}% (${formatFileSize(totalOriginalSize - totalCompressedSize)} menos).`
                : `Tus archivo${compressedFilesCount !== 1 ? 's' : ''} ya ${compressedFilesCount !== 1 ? 'estaban' : 'estaba'} optimizado${compressedFilesCount !== 1 ? 's' : ''}; se ${compressedFilesCount !== 1 ? 'conservan los originales' : 'conserva el original'}.`}
            </p>
            <div className="flex flex-col justify-center gap-3 sm:flex-row">
              <Button onClick={downloadAllFiles} size="lg" className={accent.solid}>
                <Download className="mr-2 h-5 w-5" />
                Descargar {compressedFilesCount > 1 ? 'todo (ZIP)' : 'archivo'}
              </Button>
              <Button variant="outline" onClick={resetAll} size="lg">
                Comprimir otros archivos
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </ToolShell>
  );
}