import { useLayoutEffect, useRef } from 'react';

/**
 * FLIP (First, Last, Invert, Play) para listas/rejillas reordenables.
 *
 * Cuando cambia `orderKey`, anima cada hijo con `[data-flip-id]` desde su
 * posición ANTERIOR a la NUEVA. Es movimiento de elementos ya en pantalla →
 * `ease-in-out` (curva in-out-quint de Emil). Solo se anima `transform`, así
 * que corre en el compositor (GPU) vía Web Animations API, sin tocar layout.
 * Respeta `prefers-reduced-motion`: si está activo, no anima (salto directo).
 *
 * Uso:
 *   const ref = useFlip<HTMLUListElement>(items.map((i) => i.id).join('|'));
 *   <ul ref={ref}> {items.map((i) => <li data-flip-id={i.id} .../>)} </ul>
 *
 * También suaviza el reordenamiento por teclado (flechas) y el cierre de huecos
 * al eliminar, porque cualquier cambio de `orderKey` dispara el FLIP.
 */
export function useFlip<T extends HTMLElement>(orderKey: string) {
  const ref = useRef<T>(null);
  const prev = useRef<Map<string, { left: number; top: number }>>(new Map());
  // Animación viva por elemento, para cancelarla antes de lanzar otra.
  const anims = useRef<Map<string, Animation>>(new Map());

  useLayoutEffect(() => {
    const container = ref.current;
    if (!container) return;

    const nodes = Array.from(
      container.querySelectorAll<HTMLElement>('[data-flip-id]')
    );

    const reduce =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const next = new Map<string, { left: number; top: number }>();

    for (const node of nodes) {
      const id = node.dataset.flipId;
      if (!id) continue;
      // CLAVE: medir con offsetLeft/offsetTop (posición de LAYOUT), NO con
      // getBoundingClientRect (que incluye el transform en vuelo). Si los
      // reordenamientos se encadenan más rápido que la animación, medir el
      // rect contaminaría el FLIP con el desplazamiento aún en curso y los
      // elementos "saltarían" en bucle. offset* ignora los transforms.
      const pos = { left: node.offsetLeft, top: node.offsetTop };
      const before = prev.current.get(id);

      // Invert + Play: parte del desfase anterior y resuelve a 0.
      if (!reduce && before) {
        const dx = before.left - pos.left;
        const dy = before.top - pos.top;
        if (dx || dy) {
          anims.current.get(id)?.cancel();
          const anim = node.animate(
            [
              { transform: `translate(${dx}px, ${dy}px)` },
              { transform: 'translate(0, 0)' },
            ],
            { duration: 220, easing: 'cubic-bezier(0.86, 0, 0.07, 1)' }
          );
          anims.current.set(id, anim);
        }
      }

      next.set(id, pos);
    }

    prev.current = next;
  }, [orderKey]);

  return ref;
}
