// Apertura y migraciones de la base local del historial de Medios. Es el único
// archivo que conoce los nombres de los almacenes; el resto pasa por repo.ts.
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export const DB_NAME = 'gainco-medios';
export const DB_VERSION = 1;

/** Tipos crudos: lo que se escribe. Al leer se valida con schema.ts, porque la
 *  base puede contener datos de otra versión o corruptos. */
export interface MediosDB extends DBSchema {
  sessions: {
    key: string;
    value: Record<string, unknown> & { id: string; updatedAt: string };
    indexes: { updatedAt: string };
  };
  transcripts: {
    key: string;
    value: Record<string, unknown> & { id: string };
  };
  ai_results: {
    key: [string, string, string];
    value: Record<string, unknown> & { sessionId: string; kind: string; variant: string };
    indexes: { sessionId: string };
  };
}

export type MediosDBHandle = IDBPDatabase<MediosDB>;

export function openMediosDB(): Promise<MediosDBHandle> {
  return openDB<MediosDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      // Migraciones acumulativas: cada bloque lleva la base de la versión
      // anterior a la siguiente. Nunca editar un bloque ya publicado.
      if (oldVersion < 1) {
        const sessions = db.createObjectStore('sessions', { keyPath: 'id' });
        sessions.createIndex('updatedAt', 'updatedAt');
        db.createObjectStore('transcripts', { keyPath: 'id' });
        const results = db.createObjectStore('ai_results', {
          keyPath: ['sessionId', 'kind', 'variant'],
        });
        results.createIndex('sessionId', 'sessionId');
      }
    },
  });
}
