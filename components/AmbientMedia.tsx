'use client';

import { useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

interface AmbientMediaProps {
  /** Fuente universal MP4 (H.264). Obligatoria: la entienden todos los navegadores. */
  src: string;
  /** WebM (VP9) opcional y más ligero; si se da, el navegador lo prefiere. */
  srcWebm?: string;
  /**
   * Imagen estática (el keyframe). Se ve SIEMPRE de base: mientras el video
   * carga, y como única pieza cuando el usuario pide menos movimiento.
   */
  poster: string;
  /** Texto alternativo del póster (a11y). */
  alt: string;
  /** Relación de aspecto CSS, p. ej. "16 / 9". Por defecto "16 / 9". */
  ratio?: string;
  /** Marco navy grueso (firma de la casa). Por defecto true. */
  bordered?: boolean;
  /** Reproducir en bucle. Por defecto true; false = one-shot (entra una vez). */
  loop?: boolean;
  className?: string;
}

/**
 * Media ambiental: un keyframe que cobra vida sin estorbar. El video solo se
 * monta cuando entra en viewport Y el usuario no pidió reducir movimiento, y se
 * pausa al salir de vista. El póster es la base, así nunca hay hueco ni salto y
 * la app sigue sintiéndose "al instante": el video jamás bloquea la interacción.
 */
export default function AmbientMedia({
  src,
  srcWebm,
  poster,
  alt,
  ratio = '16 / 9',
  bordered = true,
  loop = true,
  className,
}: AmbientMediaProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // ¿Montamos el video? Solo con movimiento permitido y estando en viewport.
  const [allowMotion, setAllowMotion] = useState(false);
  const [inView, setInView] = useState(false);
  const [ready, setReady] = useState(false); // el video ya puede reproducir

  // Preferencia de movimiento (la escuchamos por si cambia en caliente).
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setAllowMotion(!mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  // Lazy + pausa-fuera-de-viewport: no gastamos red ni CPU si no se ve.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin: '200px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const showVideo = allowMotion && inView;

  // Reproducir/pausar según visibilidad (autoPlay no basta al re-entrar).
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (showVideo) {
      // One-shot: al entrar en vista reproduce la secuencia completa desde cero.
      if (!loop) v.currentTime = 0;
      // Autoplay bloqueado → nos quedamos con el póster, sin romper nada.
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  }, [showVideo, loop]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative w-full overflow-hidden',
        bordered && 'rounded-lg border-4 border-ink',
        className,
      )}
      style={{ aspectRatio: ratio }}
    >
      {/* Base: el keyframe. Siempre presente → sin hueco ni salto. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={poster}
        alt={alt}
        className="absolute inset-0 h-full w-full object-cover"
        loading="lazy"
        decoding="async"
      />

      {/* El video se monta solo cuando toca y aparece con un fundido encima. */}
      {showVideo && (
        <video
          ref={videoRef}
          className={cn(
            'absolute inset-0 h-full w-full object-cover transition-opacity duration-500',
            ready ? 'opacity-100' : 'opacity-0',
          )}
          muted
          loop={loop}
          playsInline
          autoPlay
          preload="metadata"
          poster={poster}
          aria-hidden="true"
          onCanPlay={() => setReady(true)}
        >
          {srcWebm && <source src={srcWebm} type="video/webm" />}
          <source src={src} type="video/mp4" />
        </video>
      )}
    </div>
  );
}
