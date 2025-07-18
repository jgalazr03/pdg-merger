'use client';

import { useState, useRef } from 'react';
import { PDFDocument } from 'pdf-lib';
import { Upload, FileText, Download, Loader2, X, GripVertical, Edit3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface PDFFile {
  id: string;
  file: File;
  name: string;
  size: string;
}

export default function PDFMerger() {
  const [files, setFiles] = useState<PDFFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [fileName, setFileName] = useState('');
  const [fileNameError, setFileNameError] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileSelect = (selectedFiles: FileList) => {
    const newFiles = Array.from(selectedFiles)
      .filter(file => file.type === 'application/pdf')
      .map(file => ({
        id: Math.random().toString(36).substring(2, 15),
        file,
        name: file.name.replace('.pdf', ''),
        size: formatFileSize(file.size),
      }));

    setFiles(prev => [...prev, ...newFiles]);
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(file => file.id !== id));
  };

  // Drag & Drop for file upload area
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set to false if we're leaving the drop zone entirely
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const handleDragOverUpload = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDropUpload = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles.length > 0) {
      handleFileSelect(droppedFiles);
    }
  };

  // Drag & Drop for file reordering
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

    const newFiles = [...files];
    const draggedFile = newFiles[draggedIndex];
    newFiles.splice(draggedIndex, 1);
    newFiles.splice(dropIndex, 0, draggedFile);
    
    setFiles(newFiles);
    setDraggedIndex(null);
  };

  const mergePDFs = async () => {
    if (files.length < 2) return;
    if (!validateFileName(fileName)) return;

    setIsProcessing(true);
    try {
      const mergedPdf = await PDFDocument.create();

      for (const pdfFile of files) {
        const arrayBuffer = await pdfFile.file.arrayBuffer();
        const pdf = await PDFDocument.load(arrayBuffer);
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));
      }

      const pdfBytes = await mergedPdf.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
    } catch (error) {
      console.error('Error merging PDFs:', error);
      alert('Error al unir los PDFs. Por favor, intenta de nuevo.');
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
    setIsDragOver(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-6">
          <FileText className="w-8 h-8 text-blue-600" />
        </div>
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Unir PDFs
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          Combina múltiples archivos PDF en un solo documento de forma rápida y sencilla.
          Todo se procesa en tu navegador, tus archivos no salen de tu computadora.
        </p>
      </div>

      <Card className="mb-8">
        <CardContent className="p-8">
          <div
            className={cn(
              "border-2 border-dashed rounded-lg p-12 text-center transition-all cursor-pointer",
              isDragOver 
                ? "border-blue-500 bg-blue-50 scale-105" 
                : "border-gray-300 hover:border-blue-400"
            )}
            onClick={() => fileInputRef.current?.click()}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOverUpload}
            onDrop={handleDropUpload}
          >
            <Upload className={cn(
              "w-12 h-12 mx-auto mb-4 transition-colors",
              isDragOver ? "text-blue-500" : "text-gray-400"
            )} />
            <h3 className={cn(
              "text-lg font-semibold mb-2 transition-colors",
              isDragOver ? "text-blue-900" : "text-gray-900"
            )}>
              {isDragOver ? "Suelta los archivos PDF aquí" : "Selecciona archivos PDF"}
            </h3>
            <p className={cn(
              "mb-6 transition-colors",
              isDragOver ? "text-blue-700" : "text-gray-600"
            )}>
              {isDragOver 
                ? "Suelta para agregar los archivos PDF" 
                : "Haz clic aquí o arrastra y suelta tus archivos PDF"
              }
            </p>
            {!isDragOver && (
              <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                <Upload className="w-4 h-4 mr-2" />
                Seleccionar archivos
              </Button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={(e) => e.target.files && handleFileSelect(e.target.files)}
            />
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
            
            <div className="space-y-3">
              {files.map((file, index) => (
                <div
                  key={file.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, index)}
                  className={cn(
                    "flex items-center gap-4 p-4 bg-gray-50 rounded-lg border-2 border-transparent transition-all cursor-move hover:bg-gray-100",
                    draggedIndex === index && "opacity-50 scale-95"
                  )}
                >
                  <GripVertical className="w-5 h-5 text-gray-400" />
                  <div className="flex items-center gap-3 flex-1">
                    <div className="flex items-center justify-center w-10 h-10 bg-red-100 rounded">
                      <FileText className="w-5 h-5 text-red-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {file.name}
                      </p>
                      <p className="text-sm text-gray-500">
                        {file.size}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <span>#{index + 1}</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(file.id)}
                    className="text-gray-400 hover:text-red-600"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Tip:</strong> Arrastra los archivos para cambiar el orden.
                Los PDFs se unirán en el orden que aparecen aquí.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {files.length > 1 && (
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="text-center mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                ¿Listo para unir?
              </h3>
              <p className="text-gray-600">
                Se unirán {files.length} archivos PDF en un solo documento.
              </p>
            </div>

            <div className="max-w-md mx-auto mb-6">
              <Label htmlFor="filename" className="text-sm font-medium text-gray-700 mb-2 block">
                <Edit3 className="w-4 h-4 inline mr-2" />
                Nombre del archivo final
              </Label>
              <div className="relative">
                <Input
                  id="filename"
                  type="text"
                  placeholder="documento_final"
                  value={fileName}
                  onChange={(e) => handleFileNameChange(e.target.value)}
                  className={cn(
                    "pr-12",
                    fileNameError && "border-red-300 focus:border-red-500 focus:ring-red-200"
                  )}
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <span className="text-gray-500 text-sm">.pdf</span>
                </div>
              </div>
              {fileNameError && (
                <p className="mt-2 text-sm text-red-600">{fileNameError}</p>
              )}
              <p className="mt-2 text-xs text-gray-500">
                Si lo dejas vacío, se usará "documento_final.pdf"
              </p>
            </div>

            <div className="text-center">
              <Button
                onClick={mergePDFs}
                disabled={isProcessing || !!fileNameError}
                size="lg"
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <FileText className="w-5 h-5 mr-2" />
                    Unir PDFs
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {downloadUrl && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-6 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
              <Download className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-green-900 mb-2">
              ¡Listo!
            </h3>
            <p className="text-green-800 mb-6">
              Tu PDF unificado está listo para descargar como "{getValidFileName()}.pdf"
            </p>
            <div className="flex gap-4 justify-center">
              <Button
                onClick={downloadMergedPDF}
                size="lg"
                className="bg-green-600 hover:bg-green-700"
              >
                <Download className="w-5 h-5 mr-2" />
                Descargar {getValidFileName()}.pdf
              </Button>
              <Button
                variant="outline"
                onClick={resetAll}
                size="lg"
              >
                Crear otro PDF
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}