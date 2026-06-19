'use client';

import { useMemo, useState } from 'react';
import { FileText, Copy, AlertCircle } from 'lucide-react';
import ResolveSpinner from '@/components/ResolveSpinner';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { ToolAccent } from '@/lib/tools';
import { type Chunk, type SpeakerNames, plainText } from '@/lib/transcript';
import { downloadMarkdownAsDocx } from '@/lib/docx';
import { Button } from '@/components/ui/button';
import Markdown from '@/components/medios/Markdown';
import DownloadMenu from '@/components/medios/DownloadMenu';

type Props = {
  chunks: Chunk[];
  accent: ToolAccent;
  baseName: string;
  /** Nombres de los hablantes (para que el documento los use). */
  names?: SpeakerNames;
  /** 'contable' muestra las plantillas verticales del despacho; 'general' solo
   *  las generales (acta/correo/publicación). */
  variant?: 'general' | 'contable';
};

type Kind =
  | 'acta'
  | 'correo'
  | 'post'
  | 'memo-auditoria'
  | 'minuta-fiscal'
  | 'cobranza';
type Group = 'general' | 'contable';

const KINDS: { key: Kind; label: string; file: string; group: Group }[] = [
  { key: 'acta', label: 'Acta de reunión', file: 'acta', group: 'general' },
  { key: 'correo', label: 'Correo de seguimiento', file: 'correo', group: 'general' },
  { key: 'post', label: 'Publicación', file: 'publicacion', group: 'general' },
  { key: 'memo-auditoria', label: 'Memo de auditoría', file: 'memo-auditoria', group: 'contable' },
  { key: 'minuta-fiscal', label: 'Minuta fiscal', file: 'minuta-fiscal', group: 'contable' },
  { key: 'cobranza', label: 'Resumen de cobranza', file: 'cobranza', group: 'contable' },
];

const GROUPS: { key: Group; label: string }[] = [
  { key: 'general', label: 'Generales' },
  { key: 'contable', label: 'Contable y fiscal' },
];

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

/**
 * Sugiere la plantilla más probable según el contenido (heurística client-side,
 * gratis e instantánea; nadie en el mercado lo automatiza). Conservadora: cae a
 * 'acta' si no hay señales claras de un tipo específico.
 */
function suggestKind(text: string): Kind {
  const t = text.toLowerCase();
  const has = (...w: string[]) => w.some((x) => t.includes(x));
  if (has('cobranza', 'adeudo', 'pago vencido', 'saldo vencido', 'morosidad', 'pago pendiente'))
    return 'cobranza';
  if (has('auditor', 'papeles de trabajo', 'dictamen', 'partes relacionadas', 'contingencia'))
    return 'memo-auditoria';
  if (has('sat', 'declaraci', 'cfdi', 'isr', ' iva', 'impuesto', 'fiscal', 'diot', 'resico'))
    return 'minuta-fiscal';
  return 'acta';
}

/**
 * Genera un entregable a partir de la grabación: acta de reunión, correo de
 * seguimiento o publicación. Claude redacta el documento en Markdown.
 */
export default function DeliverablePanel({
  chunks,
  accent,
  baseName,
  names,
  variant = 'general',
}: Props) {
  const contable = variant === 'contable';
  const groups = contable ? GROUPS : GROUPS.filter((g) => g.key === 'general');
  // Autodetección solo en contexto contable (las plantillas verticales).
  const suggested = useMemo(
    () => (contable ? suggestKind(plainText(chunks, names)) : 'acta'),
    [chunks, names, contable]
  );
  const [kind, setKind] = useState<Kind>(suggested);
  const [phase, setPhase] = useState<'idle' | 'loading' | 'done' | 'error'>(
    'idle'
  );
  const [content, setContent] = useState('');
  const [doneKind, setDoneKind] = useState<Kind>('acta');
  const [error, setError] = useState('');

  const generate = async () => {
    setError('');
    setPhase('loading');
    try {
      const res = await fetch('/api/deliverable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: plainText(chunks, names), kind }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'No se pudo generar.');
      setContent((data.content as string) || '');
      setDoneKind(kind);
      setPhase('done');
    } catch (e) {
      setError((e as Error).message || 'No se pudo generar el documento.');
      setPhase('error');
    }
  };

  const fileBase = KINDS.find((k) => k.key === doneKind)?.file ?? 'documento';

  return (
    <div className="p-4 sm:p-5">
      <p className="mb-3 text-sm text-muted-foreground">
          Convierte la grabación en un documento listo para usar.
        </p>

        {suggested !== 'acta' && (
          <p className="mb-3 text-xs text-muted-foreground">
            Sugerido por el contenido:{' '}
            <span className="font-medium text-ink">
              {KINDS.find((k) => k.key === suggested)?.label}
            </span>
            .
          </p>
        )}

        {/* Selector de tipo, agrupado: generales y específicos contable-fiscal */}
        <div className="mb-4 space-y-3">
          {groups.map((g) => (
            <div key={g.key}>
              {groups.length > 1 && (
                <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  {g.label}
                </p>
              )}
              <div className="flex flex-wrap gap-1.5">
                {KINDS.filter((k) => k.group === g.key).map((k) => {
                  const active = kind === k.key;
                  return (
                    <button
                      key={k.key}
                      type="button"
                      onClick={() => setKind(k.key)}
                      disabled={phase === 'loading'}
                      aria-pressed={active}
                      className={cn(
                        'rounded-full border-2 px-3 py-1 text-xs font-medium transition-colors duration-150 disabled:opacity-50',
                        active
                          ? 'border-ink bg-ink text-white'
                          : 'border-ink/20 text-ink hover-fine:border-ink hover-fine:bg-muted'
                      )}
                    >
                      {k.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <Button
          onClick={generate}
          disabled={phase === 'loading'}
          className={accent.solid}
          aria-busy={phase === 'loading'}
        >
          {phase === 'loading' ? (
            <ResolveSpinner className="mr-2 h-5 w-5" />
          ) : (
            <FileText className="mr-2 h-5 w-5" />
          )}
          {phase === 'loading' ? 'Generando…' : 'Generar'}
        </Button>

        {phase === 'error' && error && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border-3 border-destructive bg-destructive/5 p-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {phase === 'done' && content && (
          <div className="mt-4">
            <div className="max-h-80 overflow-y-auto rounded-lg border-2 border-ink/15 bg-surface p-3 text-sm text-ink">
              <Markdown>{content}</Markdown>
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                onClick={() => {
                  void navigator.clipboard
                    .writeText(content)
                    .then(() => toast.success('Documento copiado'));
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
                      downloadDocx(content, `${baseName}-${fileBase}.docx`),
                  },
                  {
                    label: 'Markdown (.md)',
                    onSelect: () =>
                      downloadText(content, `${baseName}-${fileBase}.md`),
                  },
                ]}
              />
            </div>
          </div>
        )}
    </div>
  );
}
