'use client';

import { useState } from 'react';
import { ListTree, Play, Copy, AlertCircle } from 'lucide-react';
import ResolveSpinner from '@/components/ResolveSpinner';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { ToolAccent } from '@/lib/tools';
import {
  type Chunk,
  type SpeakerNames,
  clock,
  transcriptWithSeconds,
} from '@/lib/transcript';
import { type Chapter, chaptersToText } from '@/lib/chapters';
import { Button } from '@/components/ui/button';

type Props = {
  chunks: Chunk[];
  accent: ToolAccent;
  /** Nombres de los hablantes (para que el contexto enviado los use). */
  names?: SpeakerNames;
  /** Salta el reproductor al inicio del capítulo (segundos). */
  onSeek: (time: number) => void;
};

/**
 * Capítulos/temas automáticos: Claude divide la grabación en secciones con su
 * tiempo de inicio. Cada capítulo es clicable (salta el reproductor) y se pueden
 * copiar en formato de capítulos (estilo YouTube).
 */
export default function ChaptersPanel({ chunks, accent, names, onSeek }: Props) {
  const [phase, setPhase] = useState<'idle' | 'loading' | 'done' | 'error'>(
    'idle'
  );
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [error, setError] = useState('');

  const generate = async () => {
    setError('');
    setPhase('loading');
    try {
      const res = await fetch('/api/chapters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: transcriptWithSeconds(chunks, names) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'No se pudieron generar.');
      setChapters((data.chapters ?? []) as Chapter[]);
      setPhase('done');
    } catch (e) {
      setError((e as Error).message || 'No se pudieron generar los capítulos.');
      setPhase('error');
    }
  };

  return (
    <div className="p-4 sm:p-5">
      {phase === 'done' && chapters.length > 0 ? (
          <>
            <ol className="space-y-1.5">
              {chapters.map((c, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => onSeek(c.time)}
                    className="group flex w-full items-start gap-3 rounded-lg border-2 border-ink/15 px-3 py-2 text-left transition-colors duration-150 hover-fine:border-ink hover-fine:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
                  >
                    <span
                      className={cn(
                        'mt-0.5 inline-flex shrink-0 items-center gap-1 font-mono text-xs tabular-nums',
                        accent.text
                      )}
                    >
                      <Play className="h-3 w-3" strokeWidth={2.5} />
                      {clock(c.time)}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-ink">
                        {c.title}
                      </span>
                      <span className="block text-xs leading-relaxed text-muted-foreground">
                        {c.summary}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
            <div className="mt-4">
              <Button
                variant="outline"
                onClick={() => {
                  void navigator.clipboard
                    .writeText(chaptersToText(chapters))
                    .then(() => toast.success('Capítulos copiados'));
                }}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copiar capítulos
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="mb-3 text-sm text-muted-foreground">
              Divide la grabación en temas con marcas de tiempo navegables. Toca
              un capítulo para saltar ahí.
            </p>
            <Button
              onClick={generate}
              disabled={phase === 'loading'}
              className={accent.solid}
              aria-busy={phase === 'loading'}
            >
              {phase === 'loading' ? (
                <ResolveSpinner className="mr-2 h-5 w-5" />
              ) : (
                <ListTree className="mr-2 h-5 w-5" />
              )}
              {phase === 'loading' ? 'Generando capítulos…' : 'Generar capítulos'}
            </Button>
            {phase === 'error' && error && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border-3 border-destructive bg-destructive/5 p-3">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}
          </>
        )}
    </div>
  );
}
