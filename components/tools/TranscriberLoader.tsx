'use client';

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getTool } from '@/lib/tools';
import ToolShell from '@/components/tools/ToolShell';

const tool = getTool('transcribir');

// Solo en cliente: el motor de transcripción (Whisper) usa Web Worker + WASM/
// WebGPU y no debe tocar SSR.
const Transcriber = dynamic(() => import('@/components/Transcriber'), {
  ssr: false,
  loading: () => (
    <ToolShell tool={tool} step={1}>
      <div className="flex flex-col items-center py-16 text-center">
        <Loader2 className={cn('h-8 w-8 animate-spin', tool.accent.text)} />
        <p className="mt-4 text-muted-foreground">
          Cargando herramienta de transcripción…
        </p>
      </div>
    </ToolShell>
  ),
});

export default function TranscriberLoader() {
  return <Transcriber />;
}
