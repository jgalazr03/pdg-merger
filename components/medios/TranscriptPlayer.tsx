'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Play, Search, ChevronUp, ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ToolAccent } from '@/lib/tools';
import {
  type Chunk,
  type SpeakerNames,
  activeIndexAt,
  clock,
  speakerLabel,
} from '@/lib/transcript';
import { speakerColor } from '@/lib/speakers';

type Props = {
  chunks: Chunk[];
  mediaUrl: string;
  isVideo: boolean;
  accent: ToolAccent;
  /** Nombres personalizados de los hablantes (vacío = etiquetas genéricas). */
  names?: SpeakerNames;
  /** Notifica al padre el texto editado (en `onBlur`) para copiar/exportar. */
  onChange: (chunks: Chunk[]) => void;
};

/** API imperativa para que otras partes (p. ej. el panel de preguntas) salten
 *  el reproductor a un momento concreto. */
export type TranscriptPlayerHandle = { seekTo: (time: number) => void };

/** Normaliza para buscar sin distinguir mayúsculas ni acentos. */
function norm(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

/** Pliega acentos/mayúsculas CONSERVANDO la longitud carácter a carácter (1:1),
 *  para que los índices de coincidencia mapeen al texto original y se pueda
 *  envolver exactamente la palabra. (A diferencia de `norm`, que cambia el largo
 *  al descomponer en NFD.) */
function fold(s: string): string {
  let out = '';
  for (const ch of s) {
    const base = ch.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
    out += base || ch;
  }
  return out;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Recuadro de coincidencia: caja con borde navy (firma del sistema) sobre relleno
// ámbar y negrita; `box-decoration-clone` mantiene la caja al partirse en 2 líneas.
const MARK_CLASS =
  'rounded border-2 border-ink bg-amber-300 px-1 font-bold text-ink box-decoration-clone';

/** HTML del texto del segmento con cada coincidencia envuelta en un recuadro.
 *  `foldedRaw` es `fold(raw)` (mismo largo); si por algún caso raro no fuese 1:1,
 *  no resalta (devuelve el texto escapado) para no descuadrar. */
function highlightHTML(raw: string, foldedRaw: string, foldedQuery: string): string {
  if (!foldedQuery || foldedRaw.length !== raw.length) return escapeHtml(raw);
  const qlen = foldedQuery.length;
  let result = '';
  let i = 0;
  while (i <= raw.length - qlen) {
    const idx = foldedRaw.indexOf(foldedQuery, i);
    if (idx === -1) break;
    result += escapeHtml(raw.slice(i, idx));
    result += `<mark class="${MARK_CLASS}">${escapeHtml(
      raw.slice(idx, idx + qlen)
    )}</mark>`;
    i = idx + qlen;
  }
  result += escapeHtml(raw.slice(i));
  return result;
}

/**
 * Transcripción viva: reproductor + segmentos sincronizados. Tocar una línea
 * salta el audio ahí; mientras suena, la línea activa se resalta y el panel se
 * desplaza para seguirla. El texto es editable en línea (contentEditable no
 * controlado: React no pisa el contenido en cada repintado, así que el cursor
 * sobrevive al resaltado durante la reproducción).
 */
function TranscriptPlayer(
  { chunks, mediaUrl, isVideo, accent, names, onChange }: Props,
  ref: React.Ref<TranscriptPlayerHandle>
) {
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  // Elementos de texto editable por segmento (para decorar las coincidencias).
  const textRefs = useRef<(HTMLDivElement | null)[]>([]);
  // Fuente de verdad del texto editado (en ref para no repintar al teclear).
  const editsRef = useRef<string[]>(chunks.map((c) => c.text));
  const editingRef = useRef(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  // Búsqueda dentro de la transcripción (resalta y navega coincidencias).
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);

  const hasSpeakers = chunks.some((c) => c.speaker != null);

  // Centra una línea en el panel de la transcripción (reutilizable: seguimiento
  // de la reproducción y salto entre coincidencias de búsqueda).
  const centerRow = useCallback((index: number) => {
    const el = rowRefs.current[index];
    const cont = listRef.current;
    if (!el || !cont) return;
    const er = el.getBoundingClientRect();
    const cr = cont.getBoundingClientRect();
    const delta = er.top - cr.top - (cont.clientHeight / 2 - el.clientHeight / 2);
    cont.scrollTo({ top: cont.scrollTop + delta, behavior: 'smooth' });
  }, []);

  // Texto normalizado por segmento (una sola vez por transcripción) para buscar
  // sin acentos ni mayúsculas y sin recalcular en cada tecla.
  const normTexts = useMemo(() => chunks.map((c) => norm(c.text)), [chunks]);
  const matches = useMemo(() => {
    const q = norm(query.trim());
    if (!q) return [];
    const out: number[] = [];
    normTexts.forEach((t, i) => {
      if (t.includes(q)) out.push(i);
    });
    return out;
  }, [normTexts, query]);
  const matchSet = useMemo(() => new Set(matches), [matches]);
  const currentMatch = matches.length ? matches[Math.min(cursor, matches.length - 1)] : -1;
  // Texto plegado por segmento (mismo largo) para localizar y envolver la palabra.
  const foldTexts = useMemo(() => chunks.map((c) => fold(c.text)), [chunks]);

  // Al cambiar la búsqueda: vuelve a la primera coincidencia y la trae a la vista.
  useEffect(() => {
    setCursor(0);
    if (matches.length) centerRow(matches[0]);
  }, [matches, centerRow]);

  // ADITIVO al resaltado de fila: envuelve en un recuadro la(s) palabra(s) que
  // coinciden, DENTRO de cada segmento. Trabaja sobre el DOM (no por React)
  // porque el texto es contentEditable no controlado; salta el segmento que se
  // esté editando para no mover el cursor, y reconstruye desde la fuente de
  // verdad (`chunks[i].text`).
  useEffect(() => {
    const fq = fold(query.trim());
    textRefs.current.forEach((el, i) => {
      if (!el || el === document.activeElement) return;
      const raw = chunks[i]?.text ?? '';
      if (fq && foldTexts[i]?.includes(fq)) {
        el.innerHTML = highlightHTML(raw, foldTexts[i], fq);
      } else if (el.querySelector('mark')) {
        el.textContent = raw; // tenía recuadros y ya no coincide: a texto plano
      }
    });
  }, [query, chunks, foldTexts]);

  const goToMatch = useCallback(
    (dir: 1 | -1) => {
      if (!matches.length) return;
      setCursor((c) => {
        const next = (c + dir + matches.length) % matches.length;
        centerRow(matches[next]);
        return next;
      });
    },
    [matches, centerRow]
  );

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

      {/* Buscar dentro de la transcripción (resalta y navega coincidencias). */}
      {chunks.length > 6 && (
        <div className="mb-2 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  goToMatch(e.shiftKey ? -1 : 1);
                } else if (e.key === 'Escape' && query) {
                  e.preventDefault();
                  setQuery('');
                }
              }}
              placeholder="Buscar en la transcripción…"
              aria-label="Buscar en la transcripción"
              className="h-9 w-full rounded-lg border-2 border-ink/20 bg-surface pl-8 pr-8 text-sm text-ink outline-none transition-colors duration-150 focus-visible:border-ink focus-visible:ring-2 focus-visible:ring-ink"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Limpiar búsqueda"
                className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground transition-colors duration-150 hover-fine:bg-muted hover-fine:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {query.trim() && (
            <div className="flex shrink-0 items-center gap-1">
              <span
                className="min-w-[3rem] text-right font-mono text-xs tabular-nums text-muted-foreground"
                aria-live="polite"
              >
                {matches.length ? `${cursor + 1}/${matches.length}` : '0/0'}
              </span>
              <button
                type="button"
                onClick={() => goToMatch(-1)}
                disabled={!matches.length}
                aria-label="Coincidencia anterior"
                className="flex h-8 w-8 items-center justify-center rounded-lg border-2 border-ink/20 text-ink transition-colors duration-150 hover-fine:border-ink hover-fine:bg-muted disabled:opacity-40"
              >
                <ChevronUp className="h-4 w-4" strokeWidth={2.5} />
              </button>
              <button
                type="button"
                onClick={() => goToMatch(1)}
                disabled={!matches.length}
                aria-label="Coincidencia siguiente"
                className="flex h-8 w-8 items-center justify-center rounded-lg border-2 border-ink/20 text-ink transition-colors duration-150 hover-fine:border-ink hover-fine:bg-muted disabled:opacity-40"
              >
                <ChevronDown className="h-4 w-4" strokeWidth={2.5} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Transcripción sincronizada */}
      <div
        ref={listRef}
        className="max-h-[26rem] overflow-y-auto rounded-lg border-3 border-ink bg-card"
        aria-label="Transcripción sincronizada"
      >
        {chunks.map((c, i) => {
          const start = c.timestamp[0] ?? 0;
          const isActive = i === activeIndex;
          const isMatch = matchSet.has(i);
          const isCurrentMatch = i === currentMatch;
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
                isActive ? accent.soft : !isMatch && 'hover-fine:bg-muted',
                isMatch && !isActive && 'bg-amber-200/60',
                isCurrentMatch && 'ring-2 ring-inset ring-ink'
              )}
            >
              {showSpeaker && c.speaker != null && (
                <div className="mb-1 flex items-center gap-1.5">
                  <span
                    className={cn(
                      'inline-block h-2.5 w-2.5 rounded-full border-2 border-ink',
                      speakerColor(c.speaker)
                    )}
                  />
                  <span className="text-xs font-bold uppercase tracking-wide text-ink">
                    {speakerLabel(c.speaker, names)}
                  </span>
                </div>
              )}
              <div className="flex items-start gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => seek(start, i)}
                  aria-label={`Reproducir desde ${clock(start)}`}
                  className={cn(
                    'mt-0.5 flex h-7 w-[4.5rem] shrink-0 items-center justify-center gap-1 rounded border-2 font-mono text-xs tabular-nums transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-1',
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
                    textRefs.current[i] = el;
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
                  onPointerDown={(e) => {
                    // Antes de colocar el cursor: quita los recuadros de búsqueda
                    // para editar sobre texto plano (sin perder la posición del clic).
                    const el = e.currentTarget;
                    if (el.querySelector('mark'))
                      el.textContent = editsRef.current[i] ?? '';
                  }}
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
