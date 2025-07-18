'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { FileText, Scissors, Compass as Compress } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import PDFMerger from './PDFMerger';
import PDFSplitter from './PDFSplitter';

// Load PDFCompressor only on client-side to avoid SSR issues with pdfjs-dist
const PDFCompressor = dynamic(() => import('./PDFCompressor'), {
  ssr: false,
  loading: () => (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 rounded-full mb-6">
          <Compress className="w-8 h-8 text-purple-600" />
        </div>
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Comprimir PDFs
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-8">
          Cargando herramienta de compresión...
        </p>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
      </div>
    </div>
  )
});

type Tool = 'merge' | 'split' | 'compress';

export default function PDFTools() {
  const [activeTool, setActiveTool] = useState<Tool>('merge');

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="w-12 h-12 flex-shrink-0">
              <img 
                src="/logo.svg" 
                alt="Logo de la empresa" 
                className="w-full h-full object-contain"
              />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">
              Herramientas PDF
            </h1>
          </div>
          <p className="text-lg text-gray-600">
            Une o divide archivos PDF de forma rápida y segura
          </p>
        </div>

        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="flex gap-4 justify-center flex-wrap">
              <Button
                onClick={() => setActiveTool('merge')}
                variant={activeTool === 'merge' ? 'default' : 'outline'}
                size="lg"
                className={activeTool === 'merge' ? 'bg-blue-600 hover:bg-blue-700' : ''}
              >
                <FileText className="w-5 h-5 mr-2" />
                Unir PDFs
              </Button>
              <Button
                onClick={() => setActiveTool('split')}
                variant={activeTool === 'split' ? 'default' : 'outline'}
                size="lg"
                className={activeTool === 'split' ? 'bg-orange-600 hover:bg-orange-700' : ''}
              >
                <Scissors className="w-5 h-5 mr-2" />
                Dividir PDF
              </Button>
              <Button
                onClick={() => setActiveTool('compress')}
                variant={activeTool === 'compress' ? 'default' : 'outline'}
                size="lg"
                className={activeTool === 'compress' ? 'bg-purple-600 hover:bg-purple-700' : ''}
              >
                <Compress className="w-5 h-5 mr-2" />
                Comprimir PDFs
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {activeTool === 'merge' && <PDFMerger />}
      {activeTool === 'split' && <PDFSplitter />}
      {activeTool === 'compress' && <PDFCompressor />}
    </div>
  );
}