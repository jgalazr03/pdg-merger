'use client';

import { useEffect, useRef, useState } from 'react';

import { RESOLVE_EASE, RESOLVE_STAGGER } from '@/lib/motion';

/**
 * El motivo "resolve" como FIGURA (ilustración de línea), no como panel: un
 * documento delineado en navy, SIN fondo (el papel cálido se ve a través), con
 * los trazos que se alinean al entrar y un scan teal que lo recorre como un
 * flujo —vivo, pero del mismo lenguaje neo-brutalista que el resto.
 *
 * - variant "documents": trazos desordenados → alineados.
 * - variant "medios": onda de audio que se calma + transcripción que se alinea.
 *
 * Craft: solo `transform`/`opacity`; patrón determinista; base = resuelto →
 * SSR/sin-JS/reduced-motion seguros (figura quieta y resuelta).
 */

type Variant = 'documents' | 'medios';

const DOC_LINES: { w: number; dx: number; rot: number }[] = [
  { w: 96, dx: -18, rot: -1.5 },
  { w: 89, dx: 14, rot: 0.9 },
  { w: 99, dx: -10, rot: 1.3 },
  { w: 83, dx: 20, rot: -0.7 },
  { w: 94, dx: -22, rot: 1.6 },
  { w: 54, dx: 12, rot: -1.1 },
  { w: 97, dx: -14, rot: 0.6 },
  { w: 87, dx: 18, rot: -1.5 },
  { w: 95, dx: -20, rot: 1.1 },
  { w: 81, dx: 16, rot: -0.9 },
  { w: 98, dx: -12, rot: 1.4 },
  { w: 90, dx: 22, rot: -1.6 },
  { w: 46, dx: 18, rot: 1.0 },
];

const MED_WAVE = [
  34, 58, 42, 72, 50, 88, 46, 66, 38, 80, 54, 70, 44, 84, 48, 62, 36, 76, 52, 60,
];

const MED_LINES: { w: number; dx: number; rot: number }[] = [
  { w: 95, dx: -16, rot: -1.3 },
  { w: 88, dx: 14, rot: 0.8 },
  { w: 97, dx: -12, rot: 1.2 },
  { w: 82, dx: 18, rot: -0.7 },
  { w: 93, dx: -20, rot: 1.5 },
  { w: 54, dx: 12, rot: -1.1 },
  { w: 96, dx: -14, rot: 0.6 },
  { w: 86, dx: 16, rot: -1.4 },
  { w: 44, dx: 18, rot: 1.0 },
];

const INK = 'hsl(var(--ink))';
const TEAL = 'hsl(var(--highlight))';

const lineTransition = (i: number, base = 0) =>
  `transform 760ms ${RESOLVE_EASE} ${base + i * RESOLVE_STAGGER}ms, opacity 520ms ease-out ${base + i * RESOLVE_STAGGER}ms`;

export default function ResolveFigure({
  variant = 'documents',
}: {
  variant?: Variant;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [scattered, setScattered] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [alive, setAlive] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    if (reduce || typeof IntersectionObserver === 'undefined') return;

    let played = false;
    let aliveTimer = 0;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || played) return;
        played = true;
        setAnimating(false);
        setScattered(true);
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            setAnimating(true);
            setScattered(false);
          }),
        );
        aliveTimer = window.setTimeout(() => setAlive(true), 1700);
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      window.clearTimeout(aliveTimer);
    };
  }, []);

  const linesBase = variant === 'medios' ? 260 : 0;

  return (
    <div ref={ref} aria-hidden className="mx-auto w-full max-w-[18rem]">
      {/* Documento como figura: contorno navy, SIN fondo (transparente). */}
      <div
        className="relative overflow-hidden rounded-md border-2 border-ink"
        style={{ aspectRatio: '3 / 4', padding: '11% 12%' }}
      >
        {variant === 'medios' ? (
          <div className="flex h-full flex-col" style={{ gap: '7%' }}>
            {/* Onda de audio: viva en el desorden, se calma a una base tenue. */}
            <div
              className="flex items-end justify-center"
              style={{ height: '26%', gap: '2.2%' }}
            >
              {MED_WAVE.map((h, i) => (
                <span
                  key={i}
                  className="block flex-1 rounded-full"
                  style={{
                    height: `${h}%`,
                    backgroundColor: INK,
                    transformOrigin: 'bottom center',
                    opacity: scattered ? 0.9 : 0.3,
                    transform: scattered ? 'scaleY(1)' : 'scaleY(0.12)',
                    transition: animating
                      ? `transform 620ms ${RESOLVE_EASE} ${i * 18}ms, opacity 620ms ease-out ${i * 18}ms`
                      : 'none',
                  }}
                />
              ))}
            </div>
            {/* Transcripción: emerge y se alinea conforme el sonido se ordena. */}
            <div
              className="flex flex-1 flex-col justify-center"
              style={{ gap: '6%' }}
            >
              {MED_LINES.map((l, i) => (
                <span
                  key={i}
                  className="block rounded-full"
                  style={{
                    width: `${l.w}%`,
                    height: '7px',
                    backgroundColor: INK,
                    transformOrigin: 'left center',
                    opacity: scattered ? 0 : 1,
                    transform: scattered
                      ? `translateX(${l.dx}px) rotate(${l.rot}deg)`
                      : 'none',
                    transition: animating ? lineTransition(i, linesBase) : 'none',
                  }}
                />
              ))}
              <span
                className="mt-[5%] block self-end rounded-full"
                style={{
                  width: '32%',
                  height: '7px',
                  backgroundColor: TEAL,
                  transformOrigin: 'left center',
                  opacity: scattered ? 0 : 1,
                  transform: scattered ? 'scaleX(0)' : 'scaleX(1)',
                  transition: animating
                    ? `transform 460ms ${RESOLVE_EASE} ${linesBase + MED_LINES.length * RESOLVE_STAGGER + 120}ms, opacity 200ms ease-out ${linesBase + MED_LINES.length * RESOLVE_STAGGER + 120}ms`
                    : 'none',
                }}
              />
            </div>
          </div>
        ) : (
          <div
            className="flex h-full flex-col justify-center"
            style={{ gap: '4.1%' }}
          >
            {DOC_LINES.map((l, i) => (
              <span
                key={i}
                className="block rounded-full"
                style={{
                  width: `${l.w}%`,
                  height: '8px',
                  backgroundColor: INK,
                  transformOrigin: 'left center',
                  opacity: scattered ? 0.25 : 1,
                  transform: scattered
                    ? `translateX(${l.dx}px) rotate(${l.rot}deg)`
                    : 'none',
                  transition: animating ? lineTransition(i) : 'none',
                }}
              />
            ))}
            <span
              className="mt-[7%] block self-end rounded-full"
              style={{
                width: '34%',
                height: '8px',
                backgroundColor: TEAL,
                transformOrigin: 'left center',
                opacity: scattered ? 0 : 1,
                transform: scattered ? 'scaleX(0)' : 'scaleX(1)',
                transition: animating
                  ? `transform 480ms ${RESOLVE_EASE} ${DOC_LINES.length * RESOLVE_STAGGER + 130}ms, opacity 220ms ease-out ${DOC_LINES.length * RESOLVE_STAGGER + 130}ms`
                  : 'none',
              }}
            />
          </div>
        )}

        {/* Scan teal: un flujo que recorre el documento ya resuelto (el "vivo"). */}
        {alive && (
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-[32%] motion-safe:animate-[hero-scan_3.6s_ease-in-out_infinite]"
            style={{
              background:
                'linear-gradient(180deg, transparent, hsl(var(--highlight) / 0.18), transparent)',
            }}
          />
        )}
      </div>
    </div>
  );
}
