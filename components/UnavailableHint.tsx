'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { getTool, type ToolDef } from '@/lib/tools';
import type { UnavailableIntent } from '@/lib/search-tools';
import { cn } from '@/lib/utils';

/**
 * Nota honesta bajo una búsqueda: la tarea que pidió el usuario no está en el
 * hub, qué hacer en su lugar y, si existe, la herramienta que cubre parte.
 * Misma pieza en ⌘K, catálogo y panel móvil, para que el mensaje sea uno.
 *
 * `onAlternative` sustituye al enlace cuando el contenedor debe cerrarse antes
 * de navegar (diálogo de ⌘K, panel lateral).
 */
export default function UnavailableHint({
  intent,
  onAlternative,
  className,
}: {
  intent: UnavailableIntent;
  onAlternative?: (tool: ToolDef) => void;
  className?: string;
}) {
  const alt = intent.alternative ? getTool(intent.alternative) : null;
  const linkClass =
    'mt-2 inline-flex items-center gap-1.5 text-sm font-bold text-ink underline decoration-2 underline-offset-4 transition-colors hover-fine:text-brand-ocean focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 rounded-sm';

  return (
    <div
      role="note"
      className={cn(
        'rounded-lg border-3 border-ink bg-card px-3 py-2.5 text-left text-sm',
        className
      )}
    >
      <p className="font-bold text-ink">{intent.label}: no está en el hub.</p>
      <p className="mt-1 text-muted-foreground">{intent.hint}</p>
      {alt &&
        (onAlternative ? (
          <button
            type="button"
            onClick={() => onAlternative(alt)}
            className={linkClass}
          >
            Abrir {alt.name}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        ) : (
          <Link href={alt.href} className={linkClass}>
            Abrir {alt.name}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        ))}
    </div>
  );
}
