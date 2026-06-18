'use client';

import { Sparkles, ListChecks, Gavel, ListTodo, Copy, Download } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { ToolAccent } from '@/lib/tools';
import { type Minuta, minutaToText } from '@/lib/summary';
import { Button } from '@/components/ui/button';

type Props = {
  minuta: Minuta;
  baseName: string;
  accent: ToolAccent;
};

function downloadText(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function Section({
  icon,
  title,
  accent,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  accent: ToolAccent;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-5">
      <h4 className="mb-2 flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-ink">
        <span className={cn('inline-flex', accent.text)}>{icon}</span>
        {title}
      </h4>
      {children}
    </div>
  );
}

/** Render neo-brutalista de la minuta generada por Claude. Oculta las secciones
 *  vacías (una clase o nota de voz no trae acuerdos ni tareas). */
export default function SummaryPanel({ minuta, baseName, accent }: Props) {
  const md = minutaToText(minuta);

  return (
    <div className="mt-6 rounded-lg border-3 border-ink bg-card motion-safe:animate-slide-up">
      <div className={cn('flex items-center gap-2 border-b-3 border-ink px-4 py-3', accent.soft)}>
        <Sparkles className={cn('h-5 w-5', accent.text)} strokeWidth={2.5} />
        <h3 className="font-display text-base font-bold text-ink">Resumen</h3>
      </div>

      <div className="p-4 sm:p-5">
        <h2 className="text-lg font-bold leading-tight text-ink">{minuta.titulo}</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink">{minuta.resumen}</p>

        {minuta.puntosClave.length > 0 && (
          <Section icon={<ListChecks className="h-4 w-4" />} title="Puntos clave" accent={accent}>
            <ul className="space-y-1.5">
              {minuta.puntosClave.map((p, i) => (
                <li key={i} className="flex gap-2 text-sm leading-relaxed text-ink">
                  <span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', accent.line)} />
                  {p}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {minuta.acuerdos.length > 0 && (
          <Section icon={<Gavel className="h-4 w-4" />} title="Acuerdos" accent={accent}>
            <ul className="space-y-1.5">
              {minuta.acuerdos.map((a, i) => (
                <li key={i} className="flex gap-2 text-sm leading-relaxed text-ink">
                  <span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', accent.line)} />
                  {a}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {minuta.tareas.length > 0 && (
          <Section icon={<ListTodo className="h-4 w-4" />} title="Tareas" accent={accent}>
            <ul className="space-y-2">
              {minuta.tareas.map((t, i) => (
                <li
                  key={i}
                  className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded border-2 border-ink/15 px-2.5 py-1.5 text-sm text-ink"
                >
                  <span className="leading-relaxed">{t.descripcion}</span>
                  {t.responsable && (
                    <span className="rounded border-2 border-ink bg-surface px-1.5 py-0.5 font-mono text-xs text-ink">
                      {t.responsable}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </Section>
        )}

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={() => {
              void navigator.clipboard
                .writeText(md)
                .then(() => toast.success('Resumen copiado'));
            }}
          >
            <Copy className="mr-2 h-4 w-4" />
            Copiar resumen
          </Button>
          <Button
            variant="outline"
            onClick={() => downloadText(md, `${baseName}-resumen.md`)}
          >
            <Download className="mr-2 h-4 w-4" />
            Descargar resumen
          </Button>
        </div>
      </div>
    </div>
  );
}
