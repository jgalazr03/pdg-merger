// Repositorio del historial de Medios: la única puerta a IndexedDB. Los
// componentes nunca tocan la base directamente. Todo lo leído se valida; lo
// corrupto se omite y se reporta por `onCorrupt` (no rompe la UI).
import type { Chunk, SpeakerNames } from '@/lib/transcript';
import { openMediosDB, type MediosDBHandle } from './db';
import {
  SCHEMA_VERSION,
  parseAiResult,
  sessionMetaSchema,
  transcriptRecordSchema,
  type AiKind,
  type AiPayload,
  type AiResult,
  type SessionMeta,
  type TranscriptRecord,
} from './schema';

/** Límite blando: a partir de aquí la UI avisa; nunca se borra nada solo. */
export const SESSION_SOFT_LIMIT = 90;
export const SESSION_HARD_LIMIT = 100;

export type LoadedSession = {
  meta: SessionMeta;
  transcript: TranscriptRecord;
  results: AiResult[];
};

export type NewSessionInput = {
  title: string;
  tool: string;
  mode: 'local' | 'server';
  media: SessionMeta['media'];
  chunks: Chunk[];
  text: string;
  speakerNames: SpeakerNames;
};

export class HistoryLimitError extends Error {
  constructor() {
    super(`El historial llegó a ${SESSION_HARD_LIMIT} transcripciones.`);
    this.name = 'HistoryLimitError';
  }
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function durationOf(chunks: Chunk[]): number {
  const last = chunks[chunks.length - 1];
  if (!last) return 0;
  return last.timestamp[1] ?? last.timestamp[0] ?? 0;
}

function speakerCountOf(chunks: Chunk[]): number {
  const s = new Set<number>();
  for (const c of chunks) if (c.speaker != null) s.add(c.speaker);
  return Math.max(1, s.size);
}

/** IndexedDB guarda las claves de objeto como string; se normalizan al leer. */
function toSpeakerNames(raw: Record<string, string>): SpeakerNames {
  const out: SpeakerNames = {};
  for (const [k, v] of Object.entries(raw)) out[Number(k)] = v;
  return out;
}

/** Aborta sin dejar `tx.done` como promesa rechazada sin manejar. */
function abort(tx: { abort(): void; done: Promise<void> }): void {
  tx.done.catch(() => {});
  tx.abort();
}

export function createHistoryRepo(
  dbPromise: Promise<MediosDBHandle>,
  onCorrupt: (store: string) => void = () => {}
) {
  const now = () => new Date().toISOString();

  async function listSessions(): Promise<SessionMeta[]> {
    const db = await dbPromise;
    const raw = await db.getAllFromIndex('sessions', 'updatedAt');
    const out: SessionMeta[] = [];
    for (const r of raw) {
      const p = sessionMetaSchema.safeParse(r);
      if (p.success) out.push(p.data);
      else onCorrupt('sessions');
    }
    return out.reverse(); // más reciente primero
  }

  async function countSessions(): Promise<number> {
    const db = await dbPromise;
    return db.count('sessions');
  }

  async function createSession(input: NewSessionInput): Promise<SessionMeta> {
    const db = await dbPromise;
    if ((await db.count('sessions')) >= SESSION_HARD_LIMIT) {
      throw new HistoryLimitError();
    }
    const id = newId();
    const ts = now();
    const meta: SessionMeta = {
      schemaVersion: SCHEMA_VERSION,
      id,
      title: input.title,
      tool: input.tool,
      mode: input.mode,
      media: input.media,
      duration: durationOf(input.chunks),
      chunkCount: input.chunks.length,
      speakerCount: speakerCountOf(input.chunks),
      aiKinds: [],
      createdAt: ts,
      updatedAt: ts,
    };
    const transcript: TranscriptRecord = {
      schemaVersion: SCHEMA_VERSION,
      id,
      chunks: input.chunks,
      text: input.text,
      speakerNames: input.speakerNames as Record<string, string>,
    };
    const tx = db.transaction(['sessions', 'transcripts'], 'readwrite');
    await Promise.all([
      tx.objectStore('sessions').put(meta),
      tx.objectStore('transcripts').put(transcript),
      tx.done,
    ]);
    return meta;
  }

  async function getSession(id: string): Promise<LoadedSession | null> {
    const db = await dbPromise;
    const tx = db.transaction(['sessions', 'transcripts', 'ai_results']);
    const [rawMeta, rawTranscript, rawResults] = await Promise.all([
      tx.objectStore('sessions').get(id),
      tx.objectStore('transcripts').get(id),
      tx.objectStore('ai_results').index('sessionId').getAll(id),
    ]);
    if (!rawMeta || !rawTranscript) return null;
    const meta = sessionMetaSchema.safeParse(rawMeta);
    const transcript = transcriptRecordSchema.safeParse(rawTranscript);
    if (!meta.success || !transcript.success) {
      onCorrupt(meta.success ? 'transcripts' : 'sessions');
      return null;
    }
    const results: AiResult[] = [];
    for (const r of rawResults) {
      const p = parseAiResult(r);
      if (p) results.push(p);
      else onCorrupt('ai_results');
    }
    return {
      meta: meta.data,
      transcript: {
        ...transcript.data,
        speakerNames: toSpeakerNames(transcript.data.speakerNames),
      },
      results,
    };
  }

  /** Guarda la transcripción editada (texto corregido o nombres de hablante). */
  async function updateTranscript(
    id: string,
    patch: { chunks: Chunk[]; text: string; speakerNames: SpeakerNames }
  ): Promise<void> {
    const db = await dbPromise;
    const tx = db.transaction(['sessions', 'transcripts'], 'readwrite');
    const sessions = tx.objectStore('sessions');
    const rawMeta = await sessions.get(id);
    const meta = sessionMetaSchema.safeParse(rawMeta);
    if (!meta.success) {
      abort(tx);
      return;
    }
    const transcript: TranscriptRecord = {
      schemaVersion: SCHEMA_VERSION,
      id,
      chunks: patch.chunks,
      text: patch.text,
      speakerNames: patch.speakerNames as Record<string, string>,
    };
    await Promise.all([
      tx.objectStore('transcripts').put(transcript),
      sessions.put({
        ...meta.data,
        chunkCount: patch.chunks.length,
        speakerCount: speakerCountOf(patch.chunks),
        updatedAt: now(),
      }),
      tx.done,
    ]);
  }

  async function renameSession(id: string, title: string): Promise<void> {
    const db = await dbPromise;
    const tx = db.transaction('sessions', 'readwrite');
    const meta = sessionMetaSchema.safeParse(await tx.store.get(id));
    if (!meta.success) {
      abort(tx);
      return;
    }
    await Promise.all([
      tx.store.put({ ...meta.data, title, updatedAt: now() }),
      tx.done,
    ]);
  }

  async function saveResult<K extends AiKind>(
    sessionId: string,
    kind: K,
    variant: string,
    payload: AiPayload<K>,
    sourceHash: string
  ): Promise<AiResult<K>> {
    const db = await dbPromise;
    const result: AiResult<K> = {
      schemaVersion: SCHEMA_VERSION,
      sessionId,
      kind,
      variant,
      sourceHash,
      createdAt: now(),
      payload,
    };
    const tx = db.transaction(['sessions', 'ai_results'], 'readwrite');
    const sessions = tx.objectStore('sessions');
    const meta = sessionMetaSchema.safeParse(await sessions.get(sessionId));
    if (!meta.success) {
      abort(tx);
      throw new Error('La sesión ya no existe.');
    }
    const aiKinds = meta.data.aiKinds.includes(kind)
      ? meta.data.aiKinds
      : [...meta.data.aiKinds, kind];
    await Promise.all([
      tx.objectStore('ai_results').put(result),
      sessions.put({ ...meta.data, aiKinds, updatedAt: now() }),
      tx.done,
    ]);
    return result;
  }

  async function deleteSession(id: string): Promise<void> {
    const db = await dbPromise;
    const tx = db.transaction(
      ['sessions', 'transcripts', 'ai_results'],
      'readwrite'
    );
    const results = tx.objectStore('ai_results');
    const keys = await results.index('sessionId').getAllKeys(id);
    await Promise.all([
      tx.objectStore('sessions').delete(id),
      tx.objectStore('transcripts').delete(id),
      ...keys.map((k) => results.delete(k)),
      tx.done,
    ]);
  }

  async function clearAll(): Promise<void> {
    const db = await dbPromise;
    const tx = db.transaction(
      ['sessions', 'transcripts', 'ai_results'],
      'readwrite'
    );
    await Promise.all([
      tx.objectStore('sessions').clear(),
      tx.objectStore('transcripts').clear(),
      tx.objectStore('ai_results').clear(),
      tx.done,
    ]);
  }

  return {
    listSessions,
    countSessions,
    createSession,
    getSession,
    updateTranscript,
    renameSession,
    saveResult,
    deleteSession,
    clearAll,
  };
}

export type HistoryRepo = ReturnType<typeof createHistoryRepo>;

let singleton: Promise<HistoryRepo | null> | null = null;

/**
 * Repositorio del navegador, o `null` si IndexedDB no está disponible (modo
 * privado, almacenamiento bloqueado, SSR). Quien lo usa debe degradar en
 * silencio: la herramienta funciona igual, solo no guarda.
 */
export function getHistoryRepo(
  onCorrupt?: (store: string) => void
): Promise<HistoryRepo | null> {
  if (singleton) return singleton;
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  const db = openMediosDB();
  singleton = db
    .then(() => createHistoryRepo(db, onCorrupt))
    .catch(() => null);
  return singleton;
}
