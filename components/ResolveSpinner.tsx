import { cn } from '@/lib/utils';
import { RESOLVE_EASE } from '@/lib/motion';

/**
 * El motivo "resolve" en micro: tres trazos (dos navy, uno teal) que se alinean
 * en bucle. Sustituye al spinner genérico en estados de "trabajando" donde el
 * trabajo ES poner orden (la IA resolviendo una grabación en texto/estructura).
 * Decorativo: el botón ya comunica el estado con `aria-busy` y su texto.
 *
 * `prefers-reduced-motion` lo congela alineado (vía el catch-all global).
 */
const BARS = [
  { w: '100%', delay: '0ms', teal: false },
  { w: '62%', delay: '130ms', teal: false },
  { w: '82%', delay: '260ms', teal: true },
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
          className="block h-[2px] rounded-full"
          style={{
            width: b.w,
            backgroundColor: b.teal ? 'hsl(var(--highlight))' : 'hsl(var(--ink))',
            animation: `resolve-shuffle 0.8s ${RESOLVE_EASE} ${b.delay} infinite alternate`,
          }}
        />
      ))}
    </span>
  );
}
