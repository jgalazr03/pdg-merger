'use client';

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getTool } from '@/lib/tools';
import ToolShell from '@/components/tools/ToolShell';

const tool = getTool('pdf-a-jpg');

// Se carga solo en cliente para evitar problemas de SSR con pdfjs-dist.
const PDFToJPG = dynamic(() => import('@/components/PDFToJPG'), {
  ssr: false,
  loading: () => (
    <ToolShell tool={tool} step={1}>
      <div className="flex flex-col items-center py-16 text-center">
        <Loader2 className={cn('h-8 w-8 animate-spin', tool.accent.text)} />
        <p className="mt-4 text-muted-foreground">Cargando herramienta de conversión…</p>
      </div>
    </ToolShell>
  ),
});

export default function PDFToJPGLoader() {
  return <PDFToJPG />;
}
