// Eventos del historial de Medios para Vercel Analytics. Nunca llevan contenido
// (ni texto, ni nombres de archivo, ni hablantes): solo tipos, conteos y tiempos.
import { track } from '@vercel/analytics';

type Empty = Record<string, never>;
type EventMap = {
  history_saved: { tool: string; mode: string };
  history_opened: { tool: string; ms: number; results: number };
  history_ai_reused: { kind: string };
  history_media_reconnected: { match: boolean };
  history_deleted: { scope: 'one' | 'all' };
  history_disabled: Empty;
  history_quota_error: Empty;
  history_limit_reached: Empty;
  history_unavailable: Empty;
  history_corrupt_record: { store: string };
};

export function trackHistory<K extends keyof EventMap>(name: K, props: EventMap[K]): void {
  try {
    track(name, props);
  } catch {
    /* La analítica nunca debe romper la herramienta. */
  }
}

/** Error de cuota de almacenamiento (DOMException con nombres que varían por navegador). */
export function isQuotaError(e: unknown): boolean {
  return (
    e instanceof DOMException &&
    (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')
  );
}
