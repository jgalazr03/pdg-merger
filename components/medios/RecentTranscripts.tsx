'use client';

import { useCallback, useEffect, useState } from 'react';
import { History, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { ToolAccent } from '@/lib/tools';
import { clock } from '@/lib/transcript';
import {
  SESSION_HARD_LIMIT,
  SESSION_SOFT_LIMIT,
  getHistoryRepo,
  type HistoryRepo,
} from '@/lib/medios-history/repo';
import type { SessionMeta } from '@/lib/medios-history/schema';
import {
  HISTORY_FEATURE_ON,
  isHistoryEnabled,
  setHistoryEnabled,
} from '@/lib/medios-history/settings';
import { notifyHistoryChanged, onHistoryChanged } from '@/lib/medios-history/sync';
import { trackHistory } from '@/lib/medios-history/telemetry';
import { Button } from '@/components/ui/button';

const KIND_LABEL: Record<string, string> = {
  summary: 'Resumen',
  analysis: 'Análisis',
  chapters: 'Capítulos',
  deliverable: 'Documento',
  translation: 'Traducción',
  ask: 'Preguntas',
};

const PREVIEW = 5;

const dateFmt = new Intl.DateTimeFormat('es-MX', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

type State =
  | { status: 'loading' }
  | { status: 'unavailable' }
  | { status: 'ready'; repo: HistoryRepo; sessions: SessionMeta[] };

/**
 * Transcripciones guardadas en este equipo (IndexedDB). Se muestra en el paso 1
 * de las herramientas de Medios: abrir una restaura la transcripción y todos
 * sus resultados de IA sin volver a llamar a la API.
 */
export default function RecentTranscripts({
  accent,
  onOpen,
}: {
  accent: ToolAccent;
  onOpen: (id: string) => void;
}) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [enabled, setEnabled] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const refresh = useCallback(async () => {
    const repo = await getHistoryRepo((store) =>
      trackHistory('history_corrupt_record', { store })
    );
    if (!repo) {
      setState({ status: 'unavailable' });
      return;
    }
    try {
      setState({ status: 'ready', repo, sessions: await repo.listSessions() });
    } catch {
      setState({ status: 'unavailable' });
    }
  }, []);

  useEffect(() => {
    setEnabled(isHistoryEnabled());
    void refresh();
    return onHistoryChanged(() => void refresh());
  }, [refresh]);

  useEffect(() => {
    if (state.status === 'unavailable' && HISTORY_FEATURE_ON) {
      trackHistory('history_unavailable', {});
    }
  }, [state.status]);

  if (!HISTORY_FEATURE_ON || state.status === 'loading') return null;

  if (state.status === 'unavailable') {
    return (
      <p className="mb-4 text-xs text-muted-foreground">
        Este navegador no permite guardar tus transcripciones (modo privado o
        almacenamiento bloqueado). La herramienta funciona igual, pero no se
        guardará nada al cerrar la página.
      </p>
    );
  }

  const { repo, sessions } = state;

  const toggle = () => {
    const next = !enabled;
    setHistoryEnabled(next);
    setEnabled(next);
    if (!next) trackHistory('history_disabled', {});
  };

  const remove = async (id: string) => {
    const loaded = await repo.getSession(id);
    await repo.deleteSession(id);
    notifyHistoryChanged();
    trackHistory('history_deleted', { scope: 'one' });
    toast('Transcripción eliminada', {
      action: loaded
        ? {
            label: 'Deshacer',
            onClick: () => {
              void repo.restoreSession(loaded).then(notifyHistoryChanged);
            },
          }
        : undefined,
    });
  };

  const clearAll = async () => {
    await repo.clearAll();
    setConfirmClear(false);
    notifyHistoryChanged();
    trackHistory('history_deleted', { scope: 'all' });
    toast.success('Historial borrado de este equipo');
  };

  const visible = expanded ? sessions : sessions.slice(0, PREVIEW);

  return (
    <section
      aria-labelledby="recent-transcripts"
      className="mb-6 rounded-lg border-3 border-ink bg-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-3 border-ink px-4 py-3">
        <h2
          id="recent-transcripts"
          className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-ink"
        >
          <History className={cn('h-4 w-4', accent.text)} />
          Transcripciones recientes
        </h2>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={toggle}
          className="flex items-center gap-2 rounded text-xs text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
        >
          <span
            aria-hidden
            className={cn(
              'relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-ink transition-colors duration-150',
              enabled ? 'bg-ink' : 'bg-surface'
            )}
          >
            <span
              className={cn(
                'absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full transition-[left,background-color] duration-150 ease-out',
                enabled ? 'left-[18px] bg-white' : 'left-[2px] bg-ink'
              )}
            />
          </span>
          Guardar en este equipo
        </button>
      </div>

      {sessions.length === 0 ? (
        <p className="px-4 py-4 text-sm text-muted-foreground">
          {enabled
            ? 'Aquí aparecerán tus transcripciones y lo que generes con IA. Se guardan solo en este equipo; nada se sube.'
            : 'El guardado está desactivado: las nuevas transcripciones no se guardarán.'}
        </p>
      ) : (
        <>
          <ul className="divide-y-2 divide-ink/10">
            {visible.map((s) => (
              <li key={s.id} className="flex items-stretch">
                <button
                  type="button"
                  onClick={() => onOpen(s.id)}
                  className="min-w-0 flex-1 px-4 py-3 text-left transition-colors duration-150 hover-fine:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink"
                >
                  <span className="block truncate text-sm font-bold text-ink">
                    {s.title}
                  </span>
                  <span className="mt-0.5 block text-xs tabular-nums text-muted-foreground">
                    {dateFmt.format(new Date(s.updatedAt))} · {clock(s.duration)}
                    {s.speakerCount > 1 && ` · ${s.speakerCount} hablantes`}
                  </span>
                  {s.aiKinds.some((k) => KIND_LABEL[k]) && (
                    <span className="mt-1.5 flex flex-wrap gap-1">
                      {s.aiKinds
                        .filter((k) => KIND_LABEL[k])
                        .map((k) => (
                          <span
                            key={k}
                            className="rounded border-2 border-ink/20 px-1.5 py-px text-[11px] font-medium text-ink"
                          >
                            {KIND_LABEL[k]}
                          </span>
                        ))}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => void remove(s.id)}
                  aria-label={`Eliminar ${s.title}`}
                  className="flex w-11 shrink-0 items-center justify-center text-muted-foreground transition-colors duration-150 hover-fine:bg-muted hover-fine:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t-2 border-ink/10 px-4 py-2.5">
            {sessions.length > PREVIEW ? (
              <Button variant="ghost" size="sm" onClick={() => setExpanded((v) => !v)}>
                {expanded ? 'Ver menos' : `Ver todas (${sessions.length})`}
              </Button>
            ) : (
              <span />
            )}
            {confirmClear ? (
              <span className="flex items-center gap-2 text-xs text-ink">
                ¿Borrar {sessions.length === 1 ? 'la transcripción' : `las ${sessions.length}`}?
                <Button variant="destructive" size="sm" onClick={() => void clearAll()}>
                  Sí, borrar
                </Button>
                <Button variant="outline" size="sm" onClick={() => setConfirmClear(false)}>
                  Cancelar
                </Button>
              </span>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setConfirmClear(true)}>
                <Trash2 className="mr-2 h-4 w-4" />
                Borrar todo
              </Button>
            )}
          </div>
        </>
      )}

      {sessions.length > 0 && (
        <p
          className={cn(
            'border-t-2 border-ink/10 px-4 py-2 text-xs',
            sessions.length >= SESSION_SOFT_LIMIT ? 'text-destructive' : 'text-muted-foreground'
          )}
        >
          {sessions.length >= SESSION_SOFT_LIMIT
            ? `Tienes ${sessions.length} de ${SESSION_HARD_LIMIT} transcripciones guardadas. Borra las que ya no necesites para seguir guardando.`
            : 'Se guardan solo en este equipo; nada se sube.'}
        </p>
      )}
    </section>
  );
}
