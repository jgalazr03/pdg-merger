'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ToolAccent } from '@/lib/tools';
import { type Chunk, activeIndexAt, clock, speakerLabel } from '@/lib/transcript';

type Props = {
  chunks: Chunk[];
  mediaUrl: string;
  isVideo: boolean;
  accent: ToolAccent;
  /** Notifica al padre el texto editado (en `onBlur`) para copiar/exportar. */
  onChange: (chunks: Chunk[]) => void;
};

/** API imperativa para que otras partes (p. ej. el panel de preguntas) salten
 *  el reproductor a un momento concreto. */
export type TranscriptPlayerHandle = { seekTo: (time: number) => void };

// Color por hablante (clases LITERALES para el JIT de Tailwind). Solo se usan
// cuando hubo diarización; se ciclan si hay más hablantes que colores.
const SPEAKER_DOT = [
  'bg-violet-700',
  'bg-amber-700',
  'bg-teal-700',
  'bg-fuchsia-700',
  'bg-sky-700',
  'bg-rose-700',
];

/**
 * Transcripción viva: reproductor + segmentos sincronizados. Tocar una línea
 * salta el audio ahí; mientras suena, la línea activa se resalta y el panel se
 * desplaza para seguirla. El texto es editable en línea (contentEditable no
 * controlado: React no pisa el contenido en cada repintado, así que el cursor
 * sobrevive al resaltado durante la reproducción).
 */
function TranscriptPlayer(
  { chunks, mediaUrl, isVideo, accent, onChange }: Props,
  ref: React.Ref<TranscriptPlayerHandle>
) {
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  // Fuente de verdad del texto editado (en ref para no repintar al teclear).
  const editsRef = useRef<string[]>(chunks.map((c) => c.text));
  const editingRef = useRef(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);

  const hasSpeakers = chunks.some((c) => c.speaker != null);

  // Sincroniza el segmento activo con la reproducción.
  useEffect(() => {
    const m = mediaRef.current;
    if (!m) return;
    const onTime = () => {
      if (editingRef.current) return;
      const idx = activeIndexAt(chunks, m.currentTime);
      setActiveIndex((prev) => (prev === idx ? prev : idx));
    };
    const onPlay = () => setPlaying(true);
    const onStop = () => setPlaying(false);
    m.addEventListener('timeupdate', onTime);
    m.addEventListener('play', onPlay);
    m.addEventListener('pause', onStop);
    m.addEventListener('ended', onStop);
    return () => {
      m.removeEventListener('timeupdate', onTime);
      m.removeEventListener('play', onPlay);
      m.removeEventListener('pause', onStop);
      m.removeEventListener('ended', onStop);
    };
  }, [chunks, mediaUrl]);

  // Mantiene la línea activa centrada en el panel mientras se reproduce (sin
  // estorbar si el usuario está editando o navegando a mano).
  useEffect(() => {
    if (activeIndex < 0 || !playing || editingRef.current) return;
    const el = rowRefs.current[activeIndex];
    const cont = listRef.current;
    if (!el || !cont) return;
    const er = el.getBoundingClientRect();
    const cr = cont.getBoundingClientRect();
    const delta = er.top - cr.top - (cont.clientHeight / 2 - el.clientHeight / 2);
    cont.scrollTo({ top: cont.scrollTop + delta, behavior: 'smooth' });
  }, [activeIndex, playing]);

  const seek = useCallback((start: number, index: number) => {
    const m = mediaRef.current;
    if (!m) return;
    m.currentTime = start;
    setActiveIndex(index);
    void m.play();
  }, []);

  // Salto desde fuera (panel de preguntas): mueve el audio al momento citado,
  // resalta la línea y trae el reproductor a la vista.
  useImperativeHandle(
    ref,
    () => ({
      seekTo(time: number) {
        const m = mediaRef.current;
        if (!m) return;
        m.currentTime = time;
        setActiveIndex(activeIndexAt(chunks, time));
        void m.play();
        m.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      },
    }),
    [chunks]
  );

  const commit = useCallback(() => {
    editingRef.current = false;
    const next = chunks.map((c, i) => ({
      ...c,
      text: editsRef.current[i] ?? c.text,
    }));
    onChange(next);
  }, [chunks, onChange]);

  return (
    <div>
      {/* Reproductor */}
      <div className="overflow-hidden rounded-lg border-3 border-ink bg-surface">
        {isVideo ? (
          <video
            ref={(el) => (mediaRef.current = el)}
            src={mediaUrl}
            controls
            playsInline
            className="w-full bg-black"
          />
        ) : (
          <audio
            ref={(el) => (mediaRef.current = el)}
            src={mediaUrl}
            controls
            className="w-full"
          />
        )}
      </div>

      <p className="mb-2 mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <Play className={cn('h-3.5 w-3.5', accent.text)} strokeWidth={2.5} />
        Toca una marca de tiempo para reproducir desde ahí. Toca el texto para
        corregirlo.
      </p>

      {/* Transcripción sincronizada */}
      <div
        ref={listRef}
        className="max-h-[26rem] overflow-y-auto rounded-lg border-3 border-ink bg-card"
        aria-label="Transcripción sincronizada"
      >
        {chunks.map((c, i) => {
          const start = c.timestamp[0] ?? 0;
          const isActive = i === activeIndex;
          const showSpeaker =
            c.speaker != null && c.speaker !== chunks[i - 1]?.speaker;
          return (
            <div
              key={i}
              ref={(el) => {
                rowRefs.current[i] = el;
              }}
              className={cn(
                'border-b-2 border-ink/10 px-3 py-2 transition-colors duration-200 last:border-b-0 sm:px-4 sm:py-2.5',
                isActive ? accent.soft : 'hover-fine:bg-muted'
              )}
            >
              {showSpeaker && c.speaker != null && (
                <div className="mb-1 flex items-center gap-1.5">
                  <span
                    className={cn(
                      'inline-block h-2.5 w-2.5 rounded-full border-2 border-ink',
                      SPEAKER_DOT[c.speaker % SPEAKER_DOT.length]
                    )}
                  />
                  <span className="text-xs font-bold uppercase tracking-wide text-ink">
                    {speakerLabel(c.speaker)}
                  </span>
                </div>
              )}
              <div className="flex items-stretch gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => seek(start, i)}
                  aria-label={`Reproducir desde ${clock(start)}`}
                  className={cn(
                    'flex w-[4.5rem] shrink-0 items-center justify-center gap-1 rounded border-2 py-1 font-mono text-xs tabular-nums transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-1',
                    isActive
                      ? cn(accent.solid, 'border-ink')
                      : cn(
                          'border-ink/20 text-ink hover-fine:border-ink hover-fine:bg-muted',
                          accent.text
                        )
                  )}
                >
                  <Play className="h-3 w-3 shrink-0" strokeWidth={2.5} />
                  {clock(start)}
                </button>
                <div
                  ref={(el) => {
                    if (el && el.dataset.ready !== '1') {
                      el.textContent = editsRef.current[i] ?? '';
                      el.dataset.ready = '1';
                    }
                  }}
                  contentEditable
                  suppressContentEditableWarning
                  role="textbox"
                  aria-label={`Texto del segmento en ${clock(start)}`}
                  spellCheck={false}
                  onFocus={() => {
                    editingRef.current = true;
                  }}
                  onInput={(e) => {
                    editsRef.current[i] = e.currentTarget.textContent ?? '';
                  }}
                  onBlur={commit}
                  className={cn(
                    'min-w-0 flex-1 cursor-text rounded px-1 py-0.5 text-sm leading-relaxed text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink',
                    isActive && 'font-medium'
                  )}
                />
              </div>
            </div>
          );
        })}
      </div>

      {hasSpeakers && (
        <p className="mt-2 text-xs text-muted-foreground">
          Hablantes detectados automáticamente; puedes corregir el texto de cada
          línea.
        </p>
      )}
    </div>
  );
}

export default forwardRef(TranscriptPlayer);
