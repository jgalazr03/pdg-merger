import { useEffect, useRef, RefObject } from 'react';
import { scrollIntoViewSafe } from '@/lib/utils';

/**
 * Baja hasta `ref` la primera vez que `visible` pasa a `true` (por ejemplo,
 * cuando aparece la lista de archivos tras elegirlos), y solo por debajo de
 * `lg`. En escritorio la lista ya está a la vista bajo el dropzone y el panel
 * de acción es una columna pegajosa; en móvil el botón vive en la barra
 * inferior fija y la lista queda tapada por ella si no se desplaza.
 *
 * No vuelve a desplazar mientras la lista siga visible ("Agregar más" no debe
 * arrancar al usuario de donde está mirando); sí lo hace de nuevo si la lista
 * desaparece (limpiar todo, empezar de nuevo) y vuelve a aparecer.
 *
 * Uso:
 *   const listRef = useRef<HTMLDivElement>(null);
 *   useScrollOnAppear(listRef, files.length > 0);
 *   <Card ref={listRef}>…</Card>
 */
export function useScrollOnAppear(ref: RefObject<HTMLElement>, visible: boolean) {
  const wasVisible = useRef(false);

  useEffect(() => {
    const appeared = visible && !wasVisible.current;
    wasVisible.current = visible;
    if (!appeared) return;
    // Solo por debajo del breakpoint lg de Tailwind (1024px).
    if (!window.matchMedia('(max-width: 1023px)').matches) return;
    // Pequeña espera: el dropzone se colapsa y la tarjeta termina de montarse.
    const timer = setTimeout(() => scrollIntoViewSafe(ref.current), 100);
    return () => clearTimeout(timer);
  }, [visible, ref]);
}
