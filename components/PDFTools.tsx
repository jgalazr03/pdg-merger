'use client';

import { useState } from 'react';
import { FileText, Scissors } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import PDFMerger from './PDFMerger';
import PDFSplitter from './PDFSplitter';
import Image from 'next/image';

type Tool = 'merge' | 'split';

export default function PDFTools() {
  const [activeTool, setActiveTool] = useState<Tool>('merge');

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="w-12 h-12 flex-shrink-0">
              <Image
                src="/isotipo-gainco.svg"
                alt="Logo de la empresa"
                width={40}
                height={40}
                className="object-contain"
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
            <div className="flex gap-4 justify-center">
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
            </div>
          </CardContent>
        </Card>
      </div>

      {activeTool === 'merge' && <PDFMerger />}
      {activeTool === 'split' && <PDFSplitter />}
    </div>
  );
}