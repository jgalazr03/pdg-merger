'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';
import ExcelJS from 'exceljs';
import { Upload, FileText, Download, Loader2, X, Compass as Compress, AlertCircle, Eye, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

// @ts-ignore
import { GlobalWorkerOptions } from 'pdfjs-dist/build/pdf';
// @ts-ignore
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.js?url';

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
}

type CompressionLevel = 'low' | 'medium' | 'high';

const compressionSettings = {
  low: { scale: 1.0, quality: 0.9, description: 'Mejor calidad, menor reducción' },
  medium: { scale: 0.8, quality: 0.7, description: 'Equilibrado' },
  high: { scale: 0.6, quality: 0.5, description: 'Menor calidad, mayor reducción' }
};

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
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        alert(`"${file.name}" no es un archivo PDF o Excel válido.`);
        continue;
      }

      // Check for duplicates
      if (files.some(existingFile => existingFile.name === file.name && existingFile.originalSize === file.size)) {
        alert(`"${file.name}" ya está en la lista.`);
        continue;
      }

      // Check total size limit
      if (totalSize + file.size > maxTotalSize) {
        alert(`El tamaño total de archivos excedería el límite de 500MB.`);
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
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(file => file.id !== id));
  };

  // Drag & Drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles.length > 0) {
      handleFileSelect(droppedFiles);
    }
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
   * Compresses Excel files by reducing the size of embedded images
   * without affecting spreadsheet data, formulas, or formatting
   * 
   * Process:
   * 1. Load Excel file using ExcelJS
   * 2. Iterate through all worksheets
   * 3. Extract embedded images from each worksheet
   * 4. Compress images using Canvas API with specified quality/scale
   * 5. Replace original images with compressed versions
   * 6. Generate new Excel file with reduced size
   * 
   * @param excelFile - The ProcessableFile containing the Excel file
   * @returns Promise<Blob> - Compressed Excel file as Blob
   */
  const compressExcel = async (excelFile: ProcessableFile): Promise<Blob> => {
    const { quality } = compressionSettings[compressionLevel];
    
    try {
      // Load the Excel file
      const arrayBuffer = await excelFile.file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(arrayBuffer);

      // Process all images in the workbook
      for (const worksheet of workbook.worksheets) {
        // Get all images in this worksheet
        const images = worksheet.getImages();
        
        for (const image of images) {
          const imageModel = workbook.model.media.find(m => m.name === image.imageId);
          if (imageModel && imageModel.buffer) {
            try {
              // Compress the image using canvas
              const compressedBuffer = await compressImageBuffer(new Uint8Array(imageModel.buffer), quality);
              
              // Update the image in the workbook
              const mediaIndex = workbook.model.media.findIndex(m => m.name === image.imageId);
              if (mediaIndex !== -1) {
                // Convert Uint8Array to the Buffer type expected by ExcelJS
                const nodeBuffer = Buffer.from ? Buffer.from(compressedBuffer) : new (Buffer as any)(compressedBuffer);
                (workbook.model.media[mediaIndex] as any).buffer = nodeBuffer;
              }
            } catch (error) {
              console.warn(`Failed to compress image ${image.imageId}:`, error);
            }
          }
        }
      }

      // Save the modified workbook
      const buffer = await workbook.xlsx.writeBuffer();
      return new Blob([buffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
    } catch (error) {
      console.error('Error compressing Excel file:', error);
      throw new Error('Error al comprimir el archivo Excel');
    }
  };

  /**
   * Compresses image buffer using Canvas API
   * Reduces both quality and dimensions based on compression settings
   * 
   * @param imageBuffer - Original image as Uint8Array
   * @param quality - JPEG quality (0-1)
   * @returns Promise<Uint8Array> - Compressed image buffer
   */
  const compressImageBuffer = async (imageBuffer: Uint8Array, quality: number): Promise<Uint8Array> => {
    return new Promise((resolve, reject) => {
      try {
        // Create an image element
        const img = document.createElement('img');
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        
        img.onload = () => {
          // Calculate new dimensions (reduce by scale factor)
          const scale = compressionSettings[compressionLevel].scale;
          canvas.width = img.width * scale;
          canvas.height = img.height * scale;
          
          // Draw and compress
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          
          // Convert to blob
          canvas.toBlob((blob) => {
            if (blob) {
              blob.arrayBuffer().then(arrayBuffer => {
                resolve(new Uint8Array(arrayBuffer));
              });
            } else {
              reject(new Error('Failed to create blob'));
            }
          }, 'image/jpeg', quality);
        };
        
        img.onerror = () => reject(new Error('Failed to load image'));
        
        // Convert buffer to data URL
        const blob = new Blob([imageBuffer]);
        const url = URL.createObjectURL(blob);
        img.src = url;
      } catch (error) {
        reject(error);
      }
    });
  };

  const compressFiles = async () => {
    setIsProcessing(true);
    
    for (const file of files) {
      if (file.compressedBlob) continue; // Skip already compressed
      
      setFiles(prev => prev.map(f => 
        f.id === file.id ? { ...f, isProcessing: true, error: undefined } : f
      ));
      
      try {
        let compressedBlob: Blob;
        
        if (file.type === 'pdf') {
          compressedBlob = await compressPDF(file);
        } else if (file.type === 'excel') {
          compressedBlob = await compressExcel(file);
        } else {
          throw new Error('Tipo de archivo no soportado');
        }
        
        setFiles(prev => prev.map(f => 
          f.id === file.id ? {
            ...f,
            compressedBlob,
            compressedSize: compressedBlob.size,
            isProcessing: false
          } : f
        ));
      } catch (error) {
        console.error('Error compressing file:', error);
        setFiles(prev => prev.map(f => 
          f.id === file.id ? {
            ...f,
            isProcessing: false,
            error: 'Error al comprimir el archivo'
          } : f
        ));
      }
    }
    
    setIsProcessing(false);
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
    setIsDragOver(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const totalOriginalSize = files.reduce((sum, file) => sum + file.originalSize, 0);
  const totalCompressedSize = files.reduce((sum, file) => sum + (file.compressedSize || 0), 0);
  const compressedFilesCount = files.filter(f => f.compressedBlob).length;

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 rounded-full mb-6">
          <Compress className="w-8 h-8 text-purple-600" />
        </div>
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Comprimir PDFs y Excel
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          Reduce el tamaño de archivos PDF y Excel manteniendo la calidad visual.
          Para archivos Excel, comprime las imágenes embebidas sin afectar datos o fórmulas.
          Todo se procesa en tu navegador, tus archivos no salen de tu computadora.
        </p>
      </div>

      <Card className="mb-8">
        <CardContent className="p-8">
          <div
            className={cn(
              "border-2 border-dashed rounded-lg p-12 text-center transition-all cursor-pointer",
              isDragOver 
                ? "border-purple-500 bg-purple-50 scale-105" 
                : "border-gray-300 hover:border-purple-400"
            )}
            onClick={() => fileInputRef.current?.click()}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <Upload className={cn(
              "w-12 h-12 mx-auto mb-4 transition-colors",
              isDragOver ? "text-purple-500" : "text-gray-400"
            )} />
            <h3 className={cn(
              "text-lg font-semibold mb-2 transition-colors",
              isDragOver ? "text-purple-900" : "text-gray-900"
            )}>
              {isDragOver ? "Suelta los archivos aquí" : "Selecciona archivos PDF o Excel"}
            </h3>
            <p className={cn(
              "mb-6 transition-colors",
              isDragOver ? "text-purple-700" : "text-gray-600"
            )}>
              {isDragOver 
                ? "Suelta para agregar los archivos" 
                : "Haz clic aquí o arrastra y suelta tus archivos PDF (.pdf) o Excel (.xlsx, .xls)"
              }
            </p>
            {!isDragOver && (
              <Button className="bg-purple-600 hover:bg-purple-700">
                <Upload className="w-4 h-4 mr-2" />
                Seleccionar archivos
              </Button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.xlsx,.xls,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              className="hidden"
              onChange={(e) => e.target.files && handleFileSelect(e.target.files)}
            />
          </div>
          
          <div className="mt-6 p-4 bg-amber-50 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-amber-800">
                <p className="font-medium mb-1">Límites y consideraciones:</p>
                <ul className="space-y-1">
                  <li>• Tamaño máximo total: 500MB</li>
                  <li>• Archivos PDF (.pdf) y Excel (.xlsx, .xls) válidos</li>
                  <li>• No se permiten archivos duplicados</li>
                  <li>• Para Excel: comprime imágenes embebidas sin afectar datos</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {files.length > 0 && (
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-gray-900">
                Archivos seleccionados ({files.length})
              </h3>
              <Button
                variant="outline"
                size="sm"
                onClick={resetAll}
              >
                <X className="w-4 h-4 mr-2" />
                Limpiar todo
              </Button>
            </div>

            <div className="mb-6">
              <Label className="text-sm font-medium text-gray-700 mb-3 block">
                <Compress className="w-4 h-4 inline mr-2" />
                Nivel de compresión
              </Label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {Object.entries(compressionSettings).map(([level, settings]) => (
                  <button
                    key={level}
                    onClick={() => setCompressionLevel(level as CompressionLevel)}
                    className={cn(
                      "p-4 rounded-lg border-2 text-left transition-all",
                      compressionLevel === level
                        ? "border-purple-500 bg-purple-50"
                        : "border-gray-200 hover:border-purple-300"
                    )}
                  >
                    <div className="font-medium text-gray-900 capitalize mb-1">
                      {level === 'low' ? 'Baja' : level === 'medium' ? 'Media' : 'Alta'}
                    </div>
                    <div className="text-sm text-gray-600">
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
                  className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg border"
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
                    <div className="flex items-center justify-center w-16 h-20 bg-gray-100 rounded border">
                      {file.type === 'pdf' ? (
                        <FileText className="w-8 h-8 text-red-600" />
                      ) : (
                        <FileSpreadsheet className="w-8 h-8 text-green-600" />
                      )}
                    </div>
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      {file.name}
                    </p>
                    <div className="text-sm text-gray-500 space-y-1">
                      <p>Original: {formatFileSize(file.originalSize)}</p>
                      {file.compressedSize && (
                        <p className="text-green-600">
                          Comprimido: {formatFileSize(file.compressedSize)} 
                          ({calculateReduction(file.originalSize, file.compressedSize)}% reducción)
                        </p>
                      )}
                      {file.error && (
                        <p className="text-red-600">{file.error}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {file.isProcessing && (
                      <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
                    )}
                    {file.compressedBlob && (
                      <Button
                        onClick={() => downloadFile(file)}
                        size="sm"
                        variant="outline"
                        className="border-green-300 text-green-700 hover:bg-green-50"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Descargar
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(file.id)}
                      className="text-gray-400 hover:text-red-600"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {totalOriginalSize > 0 && (
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-sm text-blue-600 font-medium">Tamaño original total</p>
                    <p className="text-lg font-bold text-blue-900">{formatFileSize(totalOriginalSize)}</p>
                  </div>
                  {totalCompressedSize > 0 && (
                    <>
                      <div>
                        <p className="text-sm text-green-600 font-medium">Tamaño comprimido total</p>
                        <p className="text-lg font-bold text-green-900">{formatFileSize(totalCompressedSize)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-purple-600 font-medium">Reducción total</p>
                        <p className="text-lg font-bold text-purple-900">
                          {calculateReduction(totalOriginalSize, totalCompressedSize)}%
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

      {files.length > 0 && (
        <Card className="mb-8">
          <CardContent className="p-6 text-center">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              ¿Listo para comprimir?
            </h3>
            <p className="text-gray-600 mb-6">
              Se comprimirán {files.length} archivo{files.length !== 1 ? 's' : ''} con nivel de compresión {
                compressionLevel === 'low' ? 'bajo' : 
                compressionLevel === 'medium' ? 'medio' : 'alto'
              }.
            </p>
            <div className="flex gap-4 justify-center">
              <Button
                onClick={compressFiles}
                disabled={isProcessing}
                size="lg"
                className="bg-purple-600 hover:bg-purple-700"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Comprimiendo...
                  </>
                ) : (
                  <>
                    <Compress className="w-5 h-5 mr-2" />
                    Comprimir archivos
                  </>
                )}
              </Button>
              
              {compressedFilesCount > 0 && (
                <Button
                  onClick={downloadAllFiles}
                  size="lg"
                  variant="outline"
                  className="border-green-300 text-green-700 hover:bg-green-50"
                >
                  <Download className="w-5 h-5 mr-2" />
                  Descargar {compressedFilesCount > 1 ? 'ZIP' : 'archivo'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}