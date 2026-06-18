'use client';

import { useEffect, useRef, useState } from 'react';
import {
  MessageCircleQuestion,
  Play,
  Loader2,
  CornerDownLeft,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ToolAccent } from '@/lib/tools';
import { type Chunk, clock, transcriptWithSeconds } from '@/lib/transcript';
import type { Answer } from '@/lib/ask';
import { Button } from '@/components/ui/button';
import Markdown from '@/components/medios/Markdown';

type Props = {
  chunks: Chunk[];
  accent: ToolAccent;
  /** Salta el reproductor al momento citado (segundos). */
  onSeek: (time: number) => void;
};

type Turn = {
  question: string;
  answer?: Answer;
  error?: string;
  loading: boolean;
};

const SUGGESTIONS = [
  '¿Cuáles fueron los acuerdos?',
  '¿Qué tareas quedaron y de quién?',
  'Resume en una frase',
];

/**
 * "Pregúntale a tu grabación": el usuario pregunta en lenguaje natural y Claude
 * responde citando los momentos exactos del audio (chips clicables que saltan el
 * reproductor). Cada pregunta es independiente sobre la transcripción.
 */
export default function AskPanel({ chunks, accent, onSeek }: Props) {
  const [input, setInput] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);

  // Auto-scroll al final del hilo en cada cambio (pregunta enviada, respuesta
  // recibida), como un chat: el último mensaje siempre queda a la vista.
  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [turns]);

  const ask = async (questionRaw: string) => {
    const question = questionRaw.trim();
    if (!question || busy) return;
    setInput('');
    setBusy(true);
    const index = turns.length;
    setTurns((t) => [...t, { question, loading: true }]);

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          transcript: transcriptWithSeconds(chunks),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'No se pudo responder.');
      setTurns((t) =>
        t.map((turn, i) =>
          i === index ? { ...turn, answer: data.answer as Answer, loading: false } : turn
        )
      );
    } catch (e) {
      setTurns((t) =>
        t.map((turn, i) =>
          i === index
            ? { ...turn, error: (e as Error).message, loading: false }
            : turn
        )
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-6 rounded-lg border-3 border-ink bg-card">
      <div
        className={cn(
          'flex items-center gap-2 border-b-3 border-ink px-4 py-3',
          accent.soft
        )}
      >
        <MessageCircleQuestion
          className={cn('h-5 w-5', accent.text)}
          strokeWidth={2.5}
        />
        <h3 className="font-display text-base font-bold text-ink">
          Pregúntale a tu grabación
        </h3>
      </div>

      <div className="p-4 sm:p-5">
        {turns.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Pregunta en lenguaje natural sobre lo que se dijo. La respuesta cita
            el momento exacto: toca la marca de tiempo para escucharlo.
          </p>
        ) : (
          <div
            ref={threadRef}
            className="max-h-[24rem] space-y-4 overflow-y-auto pr-1"
          >
            {turns.map((turn, i) => (
              <div key={i} className="space-y-2">
                {/* Pregunta */}
                <div className="flex justify-end">
                  <p className="max-w-[85%] rounded-lg border-2 border-ink bg-ink px-3 py-1.5 text-sm text-white">
                    {turn.question}
                  </p>
                </div>
                {/* Respuesta */}
                {turn.loading ? (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className={cn('h-4 w-4 animate-spin', accent.text)} />
                    Buscando en la grabación…
                  </p>
                ) : turn.error ? (
                  <div className="flex items-start gap-2 rounded-lg border-2 border-destructive bg-destructive/5 p-2.5">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                    <p className="text-sm text-destructive">{turn.error}</p>
                  </div>
                ) : (
                  turn.answer && (
                    <div className="max-w-[92%] rounded-lg border-2 border-ink/15 bg-surface px-3 py-2">
                      <Markdown className="text-sm text-ink">
                        {turn.answer.answer}
                      </Markdown>
                      {turn.answer.citations.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {turn.answer.citations.map((c, j) => (
                            <button
                              key={j}
                              type="button"
                              onClick={() => onSeek(c.time)}
                              title={c.quote}
                              className={cn(
                                'inline-flex items-center gap-1 rounded border-2 border-ink px-1.5 py-0.5 font-mono text-xs tabular-nums transition-colors duration-150 hover-fine:bg-ink hover-fine:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-1',
                                accent.text
                              )}
                            >
                              <Play className="h-3 w-3" strokeWidth={2.5} />
                              {clock(c.time)}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                )}
              </div>
            ))}
          </div>
        )}

        {/* Sugerencias (solo al inicio) */}
        {turns.length === 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => ask(s)}
                disabled={busy}
                className="rounded-full border-2 border-ink/20 px-2.5 py-1 text-xs text-ink transition-colors duration-150 hover-fine:border-ink hover-fine:bg-muted disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Caja de pregunta */}
        <form
          className="mt-4 flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void ask(input);
          }}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void ask(input);
              }
            }}
            rows={1}
            placeholder="Escribe tu pregunta…"
            aria-label="Pregunta sobre la grabación"
            className="min-h-[42px] flex-1 resize-none rounded-lg border-3 border-ink bg-surface px-3 py-2 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink"
          />
          <Button
            type="submit"
            disabled={busy || !input.trim()}
            className={accent.solid}
            aria-label="Preguntar"
          >
            {busy ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <CornerDownLeft className="h-5 w-5" />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
