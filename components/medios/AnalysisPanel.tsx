'use client';

import { useMemo, useState } from 'react';
import {
  Clock,
  Users,
  BarChart3,
  ListChecks,
  Gavel,
  ListTodo,
  AlertTriangle,
  Activity,
  Copy,
  Download,
  AlertCircle,
} from 'lucide-react';
import ResolveSpinner from '@/components/ResolveSpinner';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { ToolAccent } from '@/lib/tools';
import { type Chunk, type SpeakerNames, clock } from '@/lib/transcript';
import { type MeetingAnalysis, analysisToText, talkTime } from '@/lib/analysis';
import { speakerColor } from '@/lib/speakers';
import { downloadMarkdownAsDocx } from '@/lib/docx';
import { actionItemsToChecklist, actionItemsToCsv, downloadCsv } from '@/lib/tasks';
import { Button } from '@/components/ui/button';
import Markdown from '@/components/medios/Markdown';
import DownloadMenu from '@/components/medios/DownloadMenu';

type Props = {
  chunks: Chunk[];
  text: string;
  baseName: string;
  accent: ToolAccent;
  /** Nombres de los hablantes, para el reparto de participación. */
  names?: SpeakerNames;
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

function downloadDocx(md: string, filename: string) {
  void downloadMarkdownAsDocx(md, filename)
    .then(() => toast.success('Documento Word listo'))
    .catch(() => toast.error('No se pudo generar el Word'));
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

function Bullets({ items, accent }: { items: string[]; accent: ToolAccent }) {
  return (
    <ul className="space-y-1.5">
      {items.map((t, i) => (
        <li key={i} className="flex gap-2 text-sm leading-relaxed text-ink">
          <span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', accent.line)} />
          {t}
        </li>
      ))}
    </ul>
  );
}

/**
 * Análisis de la reunión/llamada. Dos capas:
 *  - Participación (talk-time por hablante): se calcula LOCAL de los chunks
 *    diarizados, sin IA, y se muestra siempre.
 *  - Análisis cualitativo (temas, decisiones, compromisos, pendientes, tono):
 *    lo emite Claude bajo demanda. Sin marco de card propio: vive en el workspace.
 */
export default function AnalysisPanel({ chunks, text, baseName, accent, names }: Props) {
  const stats = useMemo(() => talkTime(chunks, names), [chunks, names]);
  const [phase, setPhase] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [analysis, setAnalysis] = useState<MeetingAnalysis | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [error, setError] = useState('');

  const generate = async () => {
    setError('');
    setPhase('loading');
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'No se pudo generar el análisis.');
      // El modelo puede omitir algún campo pese al esquema: normalizamos para
      // que el render (y el copiar/descargar) nunca toque undefined.
      const a = (data.analysis ?? {}) as Partial<MeetingAnalysis>;
      setAnalysis({
        titulo: a.titulo ?? 'Análisis',
        tipo: a.tipo ?? '',
        resumen: a.resumen ?? '',
        temas: Array.isArray(a.temas) ? a.temas : [],
        decisiones: Array.isArray(a.decisiones) ? a.decisiones : [],
        compromisos: Array.isArray(a.compromisos) ? a.compromisos : [],
        pendientes: Array.isArray(a.pendientes) ? a.pendientes : [],
        sentimiento: a.sentimiento ?? { etiqueta: '', nota: '' },
      });
      setTruncated(!!data.truncated);
      setPhase('done');
    } catch (e) {
      setError((e as Error).message || 'No se pudo generar el análisis.');
      setPhase('error');
    }
  };

  return (
    <div className="p-4 sm:p-5">
      {/* Participación: métricas locales, siempre visibles. */}
      <div className="rounded-lg border-2 border-ink/15 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="inline-flex items-center gap-1.5 font-bold text-ink">
            <Clock className={cn('h-4 w-4', accent.text)} />
            {clock(stats.totalSeconds)}
          </span>
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <Users className="h-4 w-4" />
            {stats.diarized ? `${stats.speakers.length} hablantes` : '1 hablante'}
          </span>
        </div>

        {stats.diarized ? (
          <ul className="mt-3 space-y-2">
            {stats.speakers.map((s) => {
              const pct = Math.round(s.share * 100);
              return (
                <li key={s.speaker} className="text-sm">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5 font-medium text-ink">
                      <span
                        className={cn(
                          'inline-block h-2.5 w-2.5 shrink-0 rounded-full border-2 border-ink',
                          speakerColor(s.speaker)
                        )}
                      />
                      <span className="truncate">{s.label}</span>
                    </span>
                    <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                      {clock(s.seconds)} · {pct}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full border-2 border-ink bg-surface">
                    <div
                      className={cn('h-full transition-[width] duration-300 ease-out', accent.line)}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">
            Para ver el reparto de participación por persona, transcribe en el
            servidor (identifica hablantes).
          </p>
        )}
      </div>

      {/* Análisis cualitativo (IA). */}
      {phase === 'done' && analysis ? (
        <div className="motion-safe:animate-fade-in">
          <Section icon={<Activity className="h-4 w-4" />} title="Resumen" accent={accent}>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {analysis.tipo}
            </p>
            <Markdown className="mt-1 text-sm text-ink">{analysis.resumen}</Markdown>
          </Section>

          {analysis.temas.length > 0 && (
            <Section icon={<ListChecks className="h-4 w-4" />} title="Temas" accent={accent}>
              <Bullets items={analysis.temas} accent={accent} />
            </Section>
          )}

          {analysis.decisiones.length > 0 && (
            <Section icon={<Gavel className="h-4 w-4" />} title="Decisiones" accent={accent}>
              <Bullets items={analysis.decisiones} accent={accent} />
            </Section>
          )}

          {analysis.compromisos.length > 0 && (
            <Section icon={<ListTodo className="h-4 w-4" />} title="Compromisos" accent={accent}>
              <ul className="space-y-2">
                {analysis.compromisos.map((c, i) => (
                  <li
                    key={i}
                    className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded border-2 border-ink/15 px-2.5 py-1.5 text-sm text-ink"
                  >
                    <span className="leading-relaxed">{c.descripcion}</span>
                    {c.responsable && (
                      <span className="rounded border-2 border-ink bg-surface px-1.5 py-0.5 font-mono text-xs text-ink">
                        {c.responsable}
                      </span>
                    )}
                    {c.plazo && (
                      <span className={cn('rounded px-1.5 py-0.5 font-mono text-xs text-white', accent.line)}>
                        {c.plazo}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void navigator.clipboard
                      .writeText(actionItemsToChecklist(analysis.compromisos))
                      .then(() => toast.success('Pendientes copiados'));
                  }}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copiar pendientes
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    downloadCsv(
                      actionItemsToCsv(analysis.compromisos),
                      `${baseName}-compromisos.csv`
                    )
                  }
                >
                  <Download className="mr-2 h-4 w-4" />
                  CSV
                </Button>
              </div>
            </Section>
          )}

          {analysis.pendientes.length > 0 && (
            <Section icon={<AlertTriangle className="h-4 w-4" />} title="Pendientes" accent={accent}>
              <Bullets items={analysis.pendientes} accent={accent} />
            </Section>
          )}

          {analysis.sentimiento?.etiqueta && (
            <Section icon={<BarChart3 className="h-4 w-4" />} title="Tono" accent={accent}>
              <p className="text-sm text-ink">
                <span className="font-bold capitalize">{analysis.sentimiento.etiqueta}</span>
                {analysis.sentimiento.nota ? ` — ${analysis.sentimiento.nota}` : ''}
              </p>
            </Section>
          )}

          {truncated && (
            <p className="mt-3 text-xs text-muted-foreground">
              La transcripción era muy larga; el análisis se basó en la primera parte.
            </p>
          )}

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => {
                void navigator.clipboard
                  .writeText(analysisToText(analysis))
                  .then(() => toast.success('Análisis copiado'));
              }}
            >
              <Copy className="mr-2 h-4 w-4" />
              Copiar
            </Button>
            <DownloadMenu
              className={accent.solid}
              items={[
                {
                  label: 'Word (.docx)',
                  onSelect: () =>
                    downloadDocx(analysisToText(analysis), `${baseName}-analisis.docx`),
                },
                {
                  label: 'Markdown (.md)',
                  onSelect: () =>
                    downloadText(analysisToText(analysis), `${baseName}-analisis.md`),
                },
              ]}
            />
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <p className="mb-3 text-sm text-muted-foreground">
            Temas, decisiones, compromisos (con responsable y plazo) y el tono
            general del encuentro.
          </p>
          <Button
            onClick={generate}
            disabled={phase === 'loading'}
            className={accent.solid}
            aria-busy={phase === 'loading'}
          >
            {phase === 'loading' ? (
              <ResolveSpinner className="mr-2 h-5 w-5" />
            ) : (
              <BarChart3 className="mr-2 h-5 w-5" />
            )}
            {phase === 'loading' ? 'Analizando…' : 'Analizar reunión'}
          </Button>
          {phase === 'error' && error && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border-3 border-destructive bg-destructive/5 p-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
