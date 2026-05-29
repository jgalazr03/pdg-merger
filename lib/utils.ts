import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** True si el usuario pidió reducir el movimiento del sistema. */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Altura del header sticky (h-16 = 64px) más un pequeño respiro, para que el
 * destino del scroll no quede tapado por el header.
 */
const STICKY_HEADER_OFFSET = 80;

/**
 * Desplaza un elemento al inicio de la vista respetando `prefers-reduced-motion`
 * (suave por defecto, instantáneo si el usuario pide menos movimiento) y
 * descontando el header sticky para que el destino quede justo debajo de él.
 */
export function scrollIntoViewSafe(
  el: HTMLElement | null,
  offset = STICKY_HEADER_OFFSET
) {
  if (typeof window === 'undefined' || !el) return;
  const top = el.getBoundingClientRect().top + window.scrollY - offset;
  window.scrollTo({
    top: Math.max(0, top),
    behavior: prefersReducedMotion() ? 'auto' : 'smooth',
  });
}
