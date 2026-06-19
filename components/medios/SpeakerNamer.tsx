'use client';

import { useMemo } from 'react';
import { Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ToolAccent } from '@/lib/tools';
import { type Chunk, type SpeakerNames } from '@/lib/transcript';
import { talkTime } from '@/lib/analysis';
import { speakerColor } from '@/lib/speakers';

type Props = {
  chunks: Chunk[];
  names: SpeakerNames;
  onChange: (names: SpeakerNames) => void;
  accent: ToolAccent;
};

/**
 * Editor de nombres de hablantes. La diarización entrega «Hablante 1/2…»; aquí
 * el usuario les pone nombre real una sola vez y se propaga a la transcripción,
 * el reparto de participación, el resumen y el análisis. Se ordenan por cuánto
 * hablaron (el que más habló primero) para ayudar a reconocerlos. Solo aparece
 * cuando hubo diarización con 2+ hablantes; si no, no se renderiza.
 */
export default function SpeakerNamer({ chunks, names, onChange, accent }: Props) {
  // Sin `names`: queremos los ids y el orden por participación, no las etiquetas
  // ya renombradas (el placeholder muestra el genérico, el value el nombre real).
  const speakers = useMemo(() => talkTime(chunks).speakers, [chunks]);

  if (speakers.length < 2) return null;

  const set = (speaker: number, value: string) => {
    const next = { ...names };
    if (value.trim()) next[speaker] = value;
    else delete next[speaker];
    onChange(next);
  };

  return (
    <div className="rounded-lg border-3 border-ink bg-surface p-3 sm:p-4">
      <div className="mb-1 flex items-center gap-2">
        <Users className={cn('h-4 w-4', accent.text)} strokeWidth={2.5} />
        <h3 className="text-sm font-bold text-ink">¿Quién es quién?</h3>
      </div>
      <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
        Pon nombre a cada hablante y se usará en la transcripción, el resumen y el
        análisis. Ordenados por cuánto hablaron.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {speakers.map((s) => {
          const pct = Math.round(s.share * 100);
          return (
            <label
              key={s.speaker}
              className="flex items-center gap-2 rounded-lg border-2 border-ink/15 bg-card px-2 py-1.5 transition-colors duration-150 focus-within:border-ink"
            >
              <span
                className={cn(
                  'inline-block h-2.5 w-2.5 shrink-0 rounded-full border-2 border-ink',
                  speakerColor(s.speaker)
                )}
              />
              <input
                type="text"
                value={names[s.speaker] ?? ''}
                onChange={(e) => set(s.speaker, e.target.value)}
                placeholder={`Hablante ${s.speaker + 1}`}
                aria-label={`Nombre del Hablante ${s.speaker + 1}`}
                maxLength={40}
                className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted-foreground/70"
              />
              <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                {pct}%
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
