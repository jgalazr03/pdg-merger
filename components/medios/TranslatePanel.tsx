'use client';

import { useState } from 'react';
import { Languages, Loader2, Copy, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { ToolAccent } from '@/lib/tools';
import { type Chunk, plainText, toSrt, toVtt } from '@/lib/transcript';
import { Button } from '@/components/ui/button';
import DownloadMenu from '@/components/medios/DownloadMenu';

type Props = {
  chunks: Chunk[];
  accent: ToolAccent;
  baseName: string;
};

const LANGUAGES = ['Inglés', 'Portugués', 'Francés', 'Alemán', 'Italiano'];

type Translation = { i: number; text: string };

function downloadText(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
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
 * Traduce la transcripción a otro idioma conservando los tiempos, para exportar
 * subtítulos traducidos (.srt/.vtt) o copiar el texto. El audio sigue en su
 * idioma original; esto produce los subtítulos en el idioma destino.
 */
export default function TranslatePanel({ chunks, accent, baseName }: Props) {
  const [target, setTarget] = useState(LANGUAGES[0]);
  const [phase, setPhase] = useState<'idle' | 'loading' | 'done' | 'error'>(
    'idle'
  );
  const [translated, setTranslated] = useState<Chunk[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [doneLang, setDoneLang] = useState('');
  const [error, setError] = useState('');

  const translate = async () => {
    setError('');
    setPhase('loading');
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          segments: chunks.map((c, i) => ({ i, text: c.text })),
          target,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'No se pudo traducir.');
      const translations = Array.isArray(data.translations)
        ? (data.translations as Translation[])
        : [];
      const map = new Map<number, string>(
        translations.map((t) => [t.i, t.text])
      );
      setTranslated(
        chunks.map((c, i) => ({ ...c, text: map.get(i) ?? c.text }))
      );
      setTruncated(!!data.truncated);
      setDoneLang(target);
      setPhase('done');
    } catch (e) {
      setError((e as Error).message || 'No se pudo traducir.');
      setPhase('error');
    }
  };

  const base = `${baseName}-${doneLang.toLowerCase()}`;

  return (
    <div className="p-4 sm:p-5">
      <p className="mb-3 text-sm text-muted-foreground">
          Traduce la transcripción conservando los tiempos. Útil para subtítulos
          en otro idioma.
        </p>

        {/* Selector de idioma */}
        <div className="mb-4 flex flex-wrap gap-1.5">
          {LANGUAGES.map((lang) => {
            const active = target === lang;
            return (
              <button
                key={lang}
                type="button"
                onClick={() => setTarget(lang)}
                disabled={phase === 'loading'}
                aria-pressed={active}
                className={cn(
                  'rounded-full border-2 px-3 py-1 text-xs font-medium transition-colors duration-150 disabled:opacity-50',
                  active
                    ? 'border-ink bg-ink text-white'
                    : 'border-ink/20 text-ink hover-fine:border-ink hover-fine:bg-muted'
                )}
              >
                {lang}
              </button>
            );
          })}
        </div>

        <Button
          onClick={translate}
          disabled={phase === 'loading'}
          className={accent.solid}
          aria-busy={phase === 'loading'}
        >
          {phase === 'loading' ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          ) : (
            <Languages className="mr-2 h-5 w-5" />
          )}
          {phase === 'loading' ? `Traduciendo al ${target}…` : `Traducir al ${target}`}
        </Button>

        {phase === 'error' && error && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border-3 border-destructive bg-destructive/5 p-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {phase === 'done' && translated.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-sm font-bold text-ink">
              Traducción al {doneLang}
            </p>
            <div className="max-h-56 overflow-y-auto whitespace-pre-wrap rounded-lg border-2 border-ink/15 bg-surface p-3 text-sm leading-relaxed text-ink">
              {plainText(translated)}
            </div>
            {truncated && (
              <p className="mt-2 text-xs text-muted-foreground">
                La transcripción era muy larga; se tradujo la primera parte.
              </p>
            )}
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                onClick={() => {
                  void navigator.clipboard
                    .writeText(plainText(translated))
                    .then(() => toast.success('Traducción copiada'));
                }}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copiar
              </Button>
              <DownloadMenu
                className={accent.solid}
                items={[
                  {
                    label: 'Subtítulos (.srt)',
                    onSelect: () => downloadText(toSrt(translated), `${base}.srt`),
                  },
                  {
                    label: 'Subtítulos (.vtt)',
                    onSelect: () => downloadText(toVtt(translated), `${base}.vtt`),
                  },
                  {
                    label: 'Texto (.txt)',
                    onSelect: () =>
                      downloadText(plainText(translated), `${base}.txt`),
                  },
                ]}
              />
            </div>
          </div>
        )}
    </div>
  );
}
