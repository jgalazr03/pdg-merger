'use client';

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';
import { getTool } from '@/lib/tools';
import ToolShell from '@/components/tools/ToolShell';

const tool = getTool('comprimir');

// Se carga solo en cliente para evitar problemas de SSR con pdfjs-dist.
const PDFCompressor = dynamic(() => import('@/components/PDFCompressor'), {
  ssr: false,
  loading: () => (
    <ToolShell tool={tool} step={1}>
      <div className="flex flex-col items-center py-16 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
        <p className="mt-4 text-gray-600">Cargando herramienta de compresión…</p>
      </div>
    </ToolShell>
  ),
});

export default function CompressorLoader() {
  return <PDFCompressor />;
}
