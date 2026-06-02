'use client';

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getTool } from '@/lib/tools';
import ToolShell from '@/components/tools/ToolShell';

const tool = getTool('ocr');

// Solo en cliente: tesseract.js usa Web Worker + WASM y no debe tocar SSR.
const OcrTool = dynamic(() => import('@/components/OcrTool'), {
  ssr: false,
  loading: () => (
    <ToolShell tool={tool} step={1}>
      <div className="flex flex-col items-center py-16 text-center">
        <Loader2 className={cn('h-8 w-8 animate-spin', tool.accent.text)} />
        <p className="mt-4 text-muted-foreground">Cargando herramienta de OCR…</p>
      </div>
    </ToolShell>
  ),
});

export default function OcrLoader() {
  return <OcrTool />;
}
