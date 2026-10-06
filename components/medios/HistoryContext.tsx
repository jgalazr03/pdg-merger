'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import type { Chunk, SpeakerNames } from '@/lib/transcript';
import { getHistoryRepo } from '@/lib/medios-history/repo';
import { sourceHashFor } from '@/lib/medios-history/hash';
import {
  resultKey,
  type AiKind,
  type AiPayload,
  type AiResult,
} from '@/lib/medios-history/schema';
import { isQuotaError, trackHistory } from '@/lib/medios-history/telemetry';
import { notifyHistoryChanged } from '@/lib/medios-history/sync';
import { Button } from '@/components/ui/button';

type Ctx = {
  results: Map<string, AiResult>;
  hashFor: (kind: AiKind) => string;
  save: <K extends AiKind>(kind: K, variant: string, payload: AiPayload<K>) => void;
};

const HistoryCtx = createContext<Ctx | null>(null);

/**
 * Resultados de IA de la sesión abierta. Los paneles leen de aquí lo ya
 * generado (sin volver a llamar a la API) y guardan cada resultado nuevo. Sin
 * `sessionId` (historial apagado o no disponible) los resultados viven solo en
 * memoria, igual que antes de existir el historial.
 */
export function HistoryProvider({
  sessionId,
  initialResults,
  chunks,
  names,
  text,
  children,
}: {
  sessionId: string | null;
  initialResults: AiResult[];
  chunks: Chunk[];
  names: SpeakerNames;
  text: string;
  children: React.ReactNode;
}) {
  const [results, setResults] = useState(
    () => new Map(initialResults.map((r) => [resultKey(r.kind, r.variant), r]))
  );

  const hashFor = useCallback(
    (kind: AiKind) => sourceHashFor(kind, chunks, names, text),
    [chunks, names, text]
  );

  // El id puede llegar después de montar (la sesión se crea al terminar de
  // transcribir); se lee por ref para no recrear `save` en cada cambio.
  const sessionRef = useRef(sessionId);
  sessionRef.current = sessionId;

  const save = useCallback(
    <K extends AiKind>(kind: K, variant: string, payload: AiPayload<K>) => {
      const sourceHash = sourceHashFor(kind, chunks, names, text);
      const optimistic = {
        schemaVersion: 1,
        sessionId: sessionRef.current ?? '',
        kind,
        variant,
        sourceHash,
        createdAt: new Date().toISOString(),
        payload,
      } as AiResult;
      setResults((prev) => new Map(prev).set(resultKey(kind, variant), optimistic));

      const id = sessionRef.current;
      if (!id) return;
      void getHistoryRepo().then(async (repo) => {
        if (!repo) return;
        try {
          await repo.saveResult(id, kind, variant, payload, sourceHash);
          notifyHistoryChanged();
        } catch (e) {
          if (isQuotaError(e)) {
            trackHistory('history_quota_error', {});
            toast.error('No hay espacio para guardar este resultado', {
              description: 'Borra transcripciones antiguas del historial para liberar espacio.',
            });
          }
          // Otros fallos (sesión borrada en otra pestaña): el resultado sigue
          // visible en memoria; no vale la pena interrumpir al usuario.
        }
      });
    },
    [chunks, names, text]
  );

  const value = useMemo(() => ({ results, hashFor, save }), [results, hashFor, save]);
  return <HistoryCtx.Provider value={value}>{children}</HistoryCtx.Provider>;
}

export type Persisted<K extends AiKind> = {
  payload: AiPayload<K>;
  /** Se generó con otro texto o con otros nombres de hablante. */
  stale: boolean;
};

/**
 * Resultados guardados de un tipo para el panel que lo usa. Fuera de un
 * `HistoryProvider` devuelve un no-op (el panel funciona como siempre).
 */
export function usePersisted<K extends AiKind>(kind: K) {
  const ctx = useContext(HistoryCtx);
  const results = ctx?.results;
  const currentHash = ctx?.hashFor(kind);

  const get = useCallback(
    (variant = ''): Persisted<K> | null => {
      const r = results?.get(resultKey(kind, variant));
      if (!r) return null;
      return {
        payload: r.payload as AiPayload<K>,
        stale: r.sourceHash !== currentHash,
      };
    },
    [results, kind, currentHash]
  );

  const ctxSave = ctx?.save;
  const save = useCallback(
    (payload: AiPayload<K>, variant = '') => ctxSave?.(kind, variant, payload),
    [ctxSave, kind]
  );

  return { get, save };
}

/** Registra (una vez por montaje) que se reutilizó un resultado guardado. */
export function useTrackReuse(kind: AiKind, reused: boolean) {
  const done = useRef(false);
  useEffect(() => {
    if (reused && !done.current) {
      done.current = true;
      trackHistory('history_ai_reused', { kind });
    }
  }, [kind, reused]);
}

/** Aviso de resultado desactualizado, con atajo para regenerarlo. */
export function StaleNotice({
  onRegenerate,
  busy,
}: {
  onRegenerate: () => void;
  busy?: boolean;
}) {
  return (
    <div
      role="status"
      className="mb-3 flex flex-col gap-2 rounded-lg border-2 border-ink/20 bg-surface p-3 text-sm text-ink sm:flex-row sm:items-center sm:justify-between"
    >
      <p>Se generó antes de tus últimos cambios en la transcripción.</p>
      <Button
        variant="outline"
        size="sm"
        onClick={onRegenerate}
        disabled={busy}
        className="shrink-0"
      >
        <RotateCcw className="mr-2 h-4 w-4" />
        Regenerar
      </Button>
    </div>
  );
}
