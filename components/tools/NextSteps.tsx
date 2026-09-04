'use client';

import { useRouter } from 'next/navigation';
import { getTool, ToolDef } from '@/lib/tools';
import { offerHandoff } from '@/lib/handoff';
import { cn } from '@/lib/utils';

interface NextStepsProps {
  tool: ToolDef;
  /** Archivo recién generado a traspasar; `null` si aún no hay resultado. */
  getFile: () => File | null;
  className?: string;
}

/**
 * Chips "Continuar con…": pasan el resultado recién generado a otra
 * herramienta curada (`tool.nextSteps`) sin que el usuario tenga que
 * descargarlo y volver a subirlo (patrón "Continue to…" de iLovePDF).
 *
 * No renderiza nada si la herramienta no tiene próximos pasos curados o si
 * todavía no hay archivo que traspasar.
 */
export default function NextSteps({ tool, getFile, className }: NextStepsProps) {
  const router = useRouter();
  const file = getFile();

  if (!tool.nextSteps?.length || !file) return null;

  return (
    <div className={className}>
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">
        Continuar con
      </p>
      <div
        role="group"
        aria-label="Continuar con otra herramienta"
        className="flex flex-wrap gap-2"
      >
        {tool.nextSteps.map((slug) => {
          const next = getTool(slug);
          return (
            <button
              key={slug}
              type="button"
              onClick={() => {
                offerHandoff(file, tool.slug);
                router.push(next.href);
              }}
              className="inline-flex items-center gap-2 rounded-lg border-3 border-ink bg-surface px-3 py-2 text-sm font-bold text-ink transition-colors hover-fine:bg-muted active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
            >
              <next.Icon
                className={cn('h-4 w-4', next.accent.text)}
                strokeWidth={2}
                aria-hidden="true"
              />
              {next.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
