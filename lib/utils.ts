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
 * Desplaza un elemento a la vista respetando `prefers-reduced-motion`:
 * suave por defecto, instantáneo si el usuario prefiere menos movimiento.
 */
export function scrollIntoViewSafe(el: HTMLElement | null) {
  if (!el) return;
  el.scrollIntoView({
    behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    block: 'start',
  });
}
