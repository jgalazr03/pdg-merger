import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Chunk } from '@/lib/transcript';
import { openMediosDB } from './db';
import {
  SESSION_HARD_LIMIT,
  HistoryLimitError,
  createHistoryRepo,
  type HistoryRepo,
  type NewSessionInput,
} from './repo';

const chunks: Chunk[] = [
  { timestamp: [0, 3], text: 'Buenos días', speaker: 0 },
  { timestamp: [3, 7.5], text: 'Revisemos el presupuesto', speaker: 1 },
];

const input = (over: Partial<NewSessionInput> = {}): NewSessionInput => ({
  title: 'junta-obra',
  tool: 'transcribir',
  mode: 'server',
  media: { name: 'junta-obra.m4a', size: 1234, type: 'audio/mp4', lastModified: 1 },
  chunks,
  text: 'Buenos días Revisemos el presupuesto',
  speakerNames: {},
  ...over,
});

let repo: HistoryRepo;
let corrupt: string[];

beforeEach(() => {
  // Base nueva y aislada por test.
  globalThis.indexedDB = new IDBFactory();
  corrupt = [];
  repo = createHistoryRepo(openMediosDB(), (s) => corrupt.push(s));
});

describe('historial de Medios', () => {
  it('crea y recupera una sesión con sus metadatos derivados', async () => {
    const meta = await repo.createSession(input());
    expect(meta.duration).toBe(7.5);
    expect(meta.speakerCount).toBe(2);
    const loaded = await repo.getSession(meta.id);
    expect(loaded?.transcript.chunks).toEqual(chunks);
    expect(loaded?.results).toEqual([]);
  });

  it('lista de la más reciente a la más antigua', async () => {
    const a = await repo.createSession(input({ title: 'a' }));
    await new Promise((r) => setTimeout(r, 5));
    const b = await repo.createSession(input({ title: 'b' }));
    const list = await repo.listSessions();
    expect(list.map((s) => s.id)).toEqual([b.id, a.id]);
  });

  it('normaliza las claves de los nombres de hablante a número', async () => {
    const meta = await repo.createSession(input({ speakerNames: { 0: 'Ana' } }));
    await repo.updateTranscript(meta.id, {
      chunks,
      text: 'x',
      speakerNames: { 1: 'Luis' },
    });
    const loaded = await repo.getSession(meta.id);
    expect(loaded?.transcript.speakerNames[1]).toBe('Luis');
    expect(loaded?.transcript.speakerNames[0]).toBeUndefined();
  });

  it('guarda resultados por tipo y variante, y los registra en la sesión', async () => {
    const meta = await repo.createSession(input());
    await repo.saveResult(meta.id, 'deliverable', 'acta', { content: '# Acta' }, 'h1');
    await repo.saveResult(meta.id, 'deliverable', 'correo', { content: 'Hola' }, 'h1');
    await repo.saveResult(meta.id, 'chapters', '', { chapters: [] }, 'h1');
    // Regenerar sobrescribe, no duplica.
    await repo.saveResult(meta.id, 'deliverable', 'acta', { content: '# Acta v2' }, 'h2');

    const loaded = await repo.getSession(meta.id);
    expect(loaded?.results).toHaveLength(3);
    const acta = loaded?.results.find((r) => r.kind === 'deliverable' && r.variant === 'acta');
    expect(acta?.payload).toEqual({ content: '# Acta v2' });
    expect(acta?.sourceHash).toBe('h2');
    expect(loaded?.meta.aiKinds.sort()).toEqual(['chapters', 'deliverable']);
  });

  it('omite y reporta registros corruptos sin romper la lectura', async () => {
    const meta = await repo.createSession(input());
    const db = await openMediosDB();
    await db.put('ai_results', {
      schemaVersion: 1,
      sessionId: meta.id,
      kind: 'summary',
      variant: '',
      sourceHash: 'x',
      createdAt: 'hoy',
      payload: { minuta: 'no es una minuta' },
    });
    await db.put('sessions', { id: 'roto', updatedAt: '9999' });
    const loaded = await repo.getSession(meta.id);
    expect(loaded?.results).toEqual([]);
    const list = await repo.listSessions();
    expect(list).toHaveLength(1);
    expect(corrupt).toEqual(expect.arrayContaining(['ai_results', 'sessions']));
  });

  it('borra una sesión con todos sus resultados', async () => {
    const a = await repo.createSession(input());
    const b = await repo.createSession(input());
    await repo.saveResult(a.id, 'chapters', '', { chapters: [] }, 'h');
    await repo.saveResult(b.id, 'chapters', '', { chapters: [] }, 'h');
    await repo.deleteSession(a.id);
    expect(await repo.getSession(a.id)).toBeNull();
    const db = await openMediosDB();
    expect(await db.count('ai_results')).toBe(1);
  });

  it('restaurar tras borrar recupera la sesión con sus resultados', async () => {
    const meta = await repo.createSession(input({ speakerNames: { 0: 'Ana' } }));
    await repo.saveResult(meta.id, 'chapters', '', { chapters: [] }, 'h');
    const loaded = await repo.getSession(meta.id);
    await repo.deleteSession(meta.id);
    await repo.restoreSession(loaded!);
    expect(await repo.getSession(meta.id)).toEqual(loaded);
  });

  it('borrar todo deja la base vacía', async () => {
    await repo.createSession(input());
    await repo.clearAll();
    expect(await repo.countSessions()).toBe(0);
  });

  it('rechaza crear más allá del límite duro', async () => {
    for (let i = 0; i < SESSION_HARD_LIMIT; i++) await repo.createSession(input());
    await expect(repo.createSession(input())).rejects.toBeInstanceOf(HistoryLimitError);
  });

  it('guardar un resultado de una sesión borrada falla de forma explícita', async () => {
    await expect(
      repo.saveResult('no-existe', 'chapters', '', { chapters: [] }, 'h')
    ).rejects.toThrow();
  });
});
