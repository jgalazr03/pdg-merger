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

/** Respiro entre el borde inferior del header sticky y el destino del scroll. */
const SCROLL_GAP = 25;
/** Fallback si no se puede medir el header (p. ej. SSR). */
const STICKY_HEADER_FALLBACK = 84;

/**
 * Altura real del header sticky en este momento (incluye su borde), medida del
 * DOM para no desincronizarse si cambia su tamaño. Cae al fallback si no hay DOM.
 */
function stickyHeaderHeight(): number {
  if (typeof document === 'undefined') return STICKY_HEADER_FALLBACK;
  const header = document.querySelector('header.sticky') ?? document.querySelector('header');
  return header instanceof HTMLElement ? header.offsetHeight : STICKY_HEADER_FALLBACK;
}

/**
 * Desplaza un elemento al inicio de la vista respetando `prefers-reduced-motion`
 * (suave por defecto, instantáneo si el usuario pide menos movimiento) y
 * descontando el header sticky + un respiro para que el destino quede holgado
 * justo debajo de él, nunca tapado.
 */
export function scrollIntoViewSafe(el: HTMLElement | null, offset?: number) {
  if (typeof window === 'undefined' || !el) return;
  const headerOffset = offset ?? stickyHeaderHeight() + SCROLL_GAP;
  const top = el.getBoundingClientRect().top + window.scrollY - headerOffset;
  window.scrollTo({
    top: Math.max(0, top),
    behavior: prefersReducedMotion() ? 'auto' : 'smooth',
  });
}
