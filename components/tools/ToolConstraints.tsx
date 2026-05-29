import { ChevronDown, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Formatos y límites de una herramienta en divulgación progresiva: una línea
 * discreta (info + chevron) que se despliega bajo demanda, en vez de un banner
 * que ocupa toda una sección. Tokens neutros (borde ink, texto muted) — NO
 * color de advertencia, porque son especificaciones, no alertas. `<details>`
 * nativo: accesible y sin JavaScript.
 */
export default function ToolConstraints({
  items,
  className,
}: {
  items: string[];
  className?: string;
}) {
  if (items.length === 0) return null;

  return (
    <details
      className={cn(
        'group mb-8 rounded-lg border-3 border-ink bg-surface',
        className
      )}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-sm font-bold text-ink transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
        <Info className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        Formatos y límites
        <ChevronDown
          className="ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <ul className="space-y-1.5 border-t-3 border-ink px-4 py-3 text-sm text-muted-foreground">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span aria-hidden="true" className="select-none text-ink">
              ·
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}
