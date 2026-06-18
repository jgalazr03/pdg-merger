'use client';

import { useState } from 'react';
import { FileText, Loader2, Copy, Download, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { ToolAccent } from '@/lib/tools';
import { type Chunk, plainText } from '@/lib/transcript';
import { Button } from '@/components/ui/button';
import Markdown from '@/components/medios/Markdown';

type Props = {
  chunks: Chunk[];
  accent: ToolAccent;
  baseName: string;
};

type Kind = 'acta' | 'correo' | 'post';

const KINDS: { key: Kind; label: string; file: string }[] = [
  { key: 'acta', label: 'Acta de reunión', file: 'acta' },
  { key: 'correo', label: 'Correo de seguimiento', file: 'correo' },
  { key: 'post', label: 'Publicación', file: 'publicacion' },
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

/**
 * Genera un entregable a partir de la grabación: acta de reunión, correo de
 * seguimiento o publicación. Claude redacta el documento en Markdown.
 */
export default function DeliverablePanel({ chunks, accent, baseName }: Props) {
  const [kind, setKind] = useState<Kind>('acta');
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
        body: JSON.stringify({ transcript: plainText(chunks), kind }),
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

        {/* Selector de tipo */}
        <div className="mb-4 flex flex-wrap gap-1.5">
          {KINDS.map((k) => {
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

        <Button
          onClick={generate}
          disabled={phase === 'loading'}
          className={accent.solid}
          aria-busy={phase === 'loading'}
        >
          {phase === 'loading' ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
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
              <Button
                variant="outline"
                onClick={() =>
                  downloadText(content, `${baseName}-${fileBase}.md`)
                }
              >
                <Download className="mr-2 h-4 w-4" />
                Descargar .md
              </Button>
            </div>
          </div>
        )}
    </div>
  );
}
