import { cn } from '@/lib/utils';
import { RESOLVE_EASE } from '@/lib/motion';

/**
 * El motivo "resolve" en micro: tres trazos que se alinean en bucle. Sustituye
 * al spinner genérico en estados de "trabajando" donde el trabajo ES poner orden
 * (la IA resolviendo una grabación en texto/estructura). La identidad la lleva
 * el MOVIMIENTO, no el color: usa `currentColor` para vivir sobre cualquier
 * fondo (botón de color sólido con texto blanco, o superficie clara).
 *
 * Decorativo: el botón ya comunica el estado con `aria-busy` y su texto.
 * `prefers-reduced-motion` lo congela alineado (vía el catch-all global).
 */
const BARS = [
  { w: '100%', delay: '0ms' },
  { w: '62%', delay: '130ms' },
  { w: '82%', delay: '260ms' },
];

export default function ResolveSpinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn('inline-flex flex-col justify-center gap-[2px]', className)}
    >
      {BARS.map((b, i) => (
        <span
          key={i}
          className="block h-[2px] rounded-full bg-current"
          style={{
            width: b.w,
            animation: `resolve-shuffle 0.8s ${RESOLVE_EASE} ${b.delay} infinite alternate`,
          }}
        />
      ))}
    </span>
  );
}
