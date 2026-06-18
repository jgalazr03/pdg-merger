'use client';

import { useState } from 'react';
import {
  Sparkles,
  ListChecks,
  Gavel,
  ListTodo,
  Copy,
  Download,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { ToolAccent } from '@/lib/tools';
import { type Minuta, minutaToText } from '@/lib/summary';
import { Button } from '@/components/ui/button';
import Markdown from '@/components/medios/Markdown';

type Props = {
  text: string;
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

/**
 * Resumen/minuta de la grabación (Claude). Autocontenido: botón → genera →
 * render. Sin marco de card propio: vive dentro del workspace de herramientas.
 */
export default function SummaryPanel({ text, baseName, accent }: Props) {
  const [phase, setPhase] = useState<'idle' | 'loading' | 'done' | 'error'>(
    'idle'
  );
  const [minuta, setMinuta] = useState<Minuta | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [error, setError] = useState('');

  const generate = async () => {
    setError('');
    setPhase('loading');
    try {
      const res = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'No se pudo generar el resumen.');
      setMinuta(data.minuta as Minuta);
      setTruncated(!!data.truncated);
      setPhase('done');
    } catch (e) {
      setError((e as Error).message || 'No se pudo generar el resumen.');
      setPhase('error');
    }
  };

  if (phase === 'done' && minuta) {
    const md = minutaToText(minuta);
    return (
      <div className="p-4 motion-safe:animate-fade-in sm:p-5">
        <h2 className="text-lg font-bold leading-tight text-ink">
          {minuta.titulo}
        </h2>
        <Markdown className="mt-2 text-sm text-ink">{minuta.resumen}</Markdown>

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

        {truncated && (
          <p className="mt-3 text-xs text-muted-foreground">
            La transcripción era muy larga; el resumen se basó en la primera parte.
          </p>
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
            Copiar
          </Button>
          <Button
            variant="outline"
            onClick={() => downloadText(md, `${baseName}-resumen.md`)}
          >
            <Download className="mr-2 h-4 w-4" />
            Descargar .md
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-5">
      <p className="mb-3 text-sm text-muted-foreground">
        Una minuta con los puntos clave, y los acuerdos y tareas si es una
        reunión.
      </p>
      <Button
        onClick={generate}
        disabled={phase === 'loading'}
        className={accent.solid}
        aria-busy={phase === 'loading'}
      >
        {phase === 'loading' ? (
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        ) : (
          <Sparkles className="mr-2 h-5 w-5" />
        )}
        {phase === 'loading' ? 'Generando resumen…' : 'Generar resumen'}
      </Button>
      {phase === 'error' && error && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border-3 border-destructive bg-destructive/5 p-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
    </div>
  );
}
