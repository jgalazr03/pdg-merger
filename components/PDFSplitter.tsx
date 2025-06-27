'use client';

import { useState, useRef } from 'react';
import { PDFDocument } from 'pdf-lib';
import { Upload, FileText, Download, Loader2, X, Scissors, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface SplitPDF {
  id: string;
  name: string;
  blob: Blob;
  pages: string;
}

export default function PDFSplitter() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [splitRanges, setSplitRanges] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [splitPDFs, setSplitPDFs] = useState<SplitPDF[]>([]);
  const [rangeError, setRangeError] = useState<string>('');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleFileSelect = async (file: File) => {
    if (file.type !== 'application/pdf') {
      alert('Por favor selecciona un archivo PDF válido.');
      return;
    }

    setSelectedFile(file);
    setSplitPDFs([]);
    setSplitRanges('');
    setRangeError('');

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer);
      setTotalPages(pdf.getPageCount());
    } catch (error) {
      console.error('Error loading PDF:', error);
      alert('Error al cargar el PDF. Asegúrate de que sea un archivo válido.');
      setSelectedFile(null);
      setTotalPages(0);
    }
  };

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
      handleFileSelect(droppedFiles[0]);
    }
  };

  const parseRanges = (rangeString: string): number[][] => {
    if (!rangeString.trim()) {
      throw new Error('Debes especificar al menos un rango o página.');
    }

    const ranges: number[][] = [];
    const parts = rangeString.split(',').map(part => part.trim());

    for (const part of parts) {
      if (part.includes('-')) {
        // Range format: "1-3"
        const [start, end] = part.split('-').map(num => parseInt(num.trim()));
        
        if (isNaN(start) || isNaN(end)) {
          throw new Error(`Rango inválido: "${part}". Usa formato como "1-3".`);
        }
        
        if (start < 1 || end < 1) {
          throw new Error(`Las páginas deben ser números positivos. Error en: "${part}".`);
        }
        
        if (start > totalPages || end > totalPages) {
          throw new Error(`Las páginas no pueden ser mayores a ${totalPages}. Error en: "${part}".`);
        }
        
        if (start > end) {
          throw new Error(`El inicio del rango no puede ser mayor al final. Error en: "${part}".`);
        }
        
        ranges.push([start, end]);
      } else {
        // Single page format: "5"
        const page = parseInt(part);
        
        if (isNaN(page)) {
          throw new Error(`Página inválida: "${part}". Debe ser un número.`);
        }
        
        if (page < 1) {
          throw new Error(`Las páginas deben ser números positivos. Error en: "${part}".`);
        }
        
        if (page > totalPages) {
          throw new Error(`La página ${page} no existe. El PDF tiene ${totalPages} páginas.`);
        }
        
        ranges.push([page, page]);
      }
    }

    return ranges;
  };

  const validateRanges = (rangeString: string): boolean => {
    try {
      parseRanges(rangeString);
      setRangeError('');
      return true;
    } catch (error) {
      setRangeError(error instanceof Error ? error.message : 'Error en el formato de rangos.');
      return false;
    }
  };

  const handleRangeChange = (value: string) => {
    setSplitRanges(value);
    if (value.trim() && totalPages > 0) {
      validateRanges(value);
    } else {
      setRangeError('');
    }
  };

  const splitPDF = async () => {
    if (!selectedFile || !validateRanges(splitRanges)) return;

    setIsProcessing(true);
    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const originalPdf = await PDFDocument.load(arrayBuffer);
      const ranges = parseRanges(splitRanges);
      const newSplitPDFs: SplitPDF[] = [];

      for (let i = 0; i < ranges.length; i++) {
        const [startPage, endPage] = ranges[i];
        const newPdf = await PDFDocument.create();
        
        // Copy pages (pdf-lib uses 0-based indexing)
        const pageIndices = [];
        for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
          pageIndices.push(pageNum - 1);
        }
        
        const copiedPages = await newPdf.copyPages(originalPdf, pageIndices);
        copiedPages.forEach(page => newPdf.addPage(page));
        
        const pdfBytes = await newPdf.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        
        const pagesDescription = startPage === endPage 
          ? `página ${startPage}` 
          : `páginas ${startPage}-${endPage}`;
        
        newSplitPDFs.push({
          id: Math.random().toString(36).substring(2, 15),
          name: `${selectedFile.name.replace('.pdf', '')}_${pagesDescription}.pdf`,
          blob,
          pages: pagesDescription,
        });
      }

      setSplitPDFs(newSplitPDFs);
    } catch (error) {
      console.error('Error splitting PDF:', error);
      alert('Error al dividir el PDF. Por favor, intenta de nuevo.');
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadPDF = (splitPDF: SplitPDF) => {
    const url = URL.createObjectURL(splitPDF.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = splitPDF.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadAllPDFs = () => {
    splitPDFs.forEach(pdf => {
      setTimeout(() => downloadPDF(pdf), 100);
    });
  };

  const resetAll = () => {
    setSelectedFile(null);
    setTotalPages(0);
    setSplitRanges('');
    setSplitPDFs([]);
    setRangeError('');
    setIsDragOver(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-orange-100 rounded-full mb-6">
          <Scissors className="w-8 h-8 text-orange-600" />
        </div>
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Dividir PDF
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          Divide un archivo PDF en múltiples documentos especificando páginas o rangos.
          Todo se procesa en tu navegador, tus archivos no salen de tu computadora.
        </p>
      </div>

      <Card className="mb-8">
        <CardContent className="p-8">
          <div
            className={cn(
              "border-2 border-dashed rounded-lg p-12 text-center transition-all cursor-pointer",
              isDragOver 
                ? "border-orange-500 bg-orange-50 scale-105" 
                : "border-gray-300 hover:border-orange-400"
            )}
            onClick={() => fileInputRef.current?.click()}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <Upload className={cn(
              "w-12 h-12 mx-auto mb-4 transition-colors",
              isDragOver ? "text-orange-500" : "text-gray-400"
            )} />
            <h3 className={cn(
              "text-lg font-semibold mb-2 transition-colors",
              isDragOver ? "text-orange-900" : "text-gray-900"
            )}>
              {isDragOver ? "Suelta el archivo PDF aquí" : "Selecciona un archivo PDF"}
            </h3>
            <p className={cn(
              "mb-6 transition-colors",
              isDragOver ? "text-orange-700" : "text-gray-600"
            )}>
              {isDragOver 
                ? "Suelta para cargar el archivo PDF" 
                : "Haz clic aquí o arrastra y suelta tu archivo PDF"
              }
            </p>
            {!isDragOver && (
              <Button className="bg-orange-600 hover:bg-orange-700">
                <Upload className="w-4 h-4 mr-2" />
                Seleccionar archivo
              </Button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
            />
          </div>
        </CardContent>
      </Card>

      {selectedFile && (
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-gray-900">
                Archivo seleccionado
              </h3>
              <Button
                variant="outline"
                size="sm"
                onClick={resetAll}
              >
                <X className="w-4 h-4 mr-2" />
                Cambiar archivo
              </Button>
            </div>
            
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded">
                <FileText className="w-6 h-6 text-red-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">
                  {selectedFile.name}
                </p>
                <p className="text-sm text-gray-500">
                  {formatFileSize(selectedFile.size)} • {totalPages} páginas
                </p>
              </div>
            </div>

            <div className="mt-6">
              <Label htmlFor="ranges" className="text-sm font-medium text-gray-700 mb-2 block">
                <Scissors className="w-4 h-4 inline mr-2" />
                Especifica las páginas o rangos a extraer
              </Label>
              <Input
                id="ranges"
                type="text"
                placeholder="Ej: 1-3, 5, 7-10"
                value={splitRanges}
                onChange={(e) => handleRangeChange(e.target.value)}
                className={cn(
                  rangeError && "border-red-300 focus:border-red-500 focus:ring-red-200"
                )}
              />
              {rangeError && (
                <div className="mt-2 flex items-start gap-2 text-sm text-red-600">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{rangeError}</span>
                </div>
              )}
              <div className="mt-2 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Ejemplos:</strong>
                </p>
                <ul className="text-sm text-blue-700 mt-1 space-y-1">
                  <li>• <code>1-3</code> - Páginas de la 1 a la 3</li>
                  <li>• <code>1, 3, 5</code> - Páginas individuales 1, 3 y 5</li>
                  <li>• <code>1-2, 5, 8-10</code> - Combina rangos y páginas individuales</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedFile && splitRanges && !rangeError && (
        <Card className="mb-8">
          <CardContent className="p-6 text-center">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              ¿Listo para dividir?
            </h3>
            <p className="text-gray-600 mb-6">
              Se crearán {parseRanges(splitRanges).length} archivos PDF según los rangos especificados.
            </p>
            <Button
              onClick={splitPDF}
              disabled={isProcessing}
              size="lg"
              className="bg-orange-600 hover:bg-orange-700"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Dividiendo...
                </>
              ) : (
                <>
                  <Scissors className="w-5 h-5 mr-2" />
                  Dividir PDF
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {splitPDFs.length > 0 && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-6">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                <Download className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-green-900 mb-2">
                ¡División completada!
              </h3>
              <p className="text-green-800 mb-4">
                Se han creado {splitPDFs.length} archivos PDF.
              </p>
              <Button
                onClick={downloadAllPDFs}
                size="lg"
                className="bg-green-600 hover:bg-green-700 mb-6"
              >
                <Download className="w-5 h-5 mr-2" />
                Descargar todos los archivos
              </Button>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium text-gray-900 mb-3">Archivos generados:</h4>
              {splitPDFs.map((pdf) => (
                <div
                  key={pdf.id}
                  className="flex items-center justify-between p-4 bg-white rounded-lg border"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 bg-green-100 rounded">
                      <FileText className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">
                        {pdf.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {pdf.pages}
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => downloadPDF(pdf)}
                    size="sm"
                    variant="outline"
                    className="border-green-300 text-green-700 hover:bg-green-50"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Descargar
                  </Button>
                </div>
              ))}
            </div>

            <div className="text-center mt-6">
              <Button
                variant="outline"
                onClick={resetAll}
                size="lg"
              >
                Dividir otro PDF
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}