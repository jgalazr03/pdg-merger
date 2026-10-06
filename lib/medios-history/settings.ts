// Preferencias del historial de Medios (solo en este equipo). Cada empleado
// tiene su propio equipo, así que el guardado viene activado por defecto; el
// usuario puede apagarlo y se le avisa la primera vez que se guarda algo.

const ENABLED_KEY = 'gainco:medios-history:enabled';
const NOTICE_KEY = 'gainco:medios-history:notice-seen';

/**
 * Interruptor de despliegue. Encendido salvo que se defina
 * NEXT_PUBLIC_MEDIOS_HISTORY=off en Vercel: así apagarlo en producción es un
 * cambio de variable + redeploy, sin tocar código.
 */
export const HISTORY_FEATURE_ON = process.env.NEXT_PUBLIC_MEDIOS_HISTORY !== 'off';

function read(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* localStorage bloqueado: la preferencia no persiste, sin más. */
  }
}

export function isHistoryEnabled(): boolean {
  return HISTORY_FEATURE_ON && read(ENABLED_KEY) !== '0';
}

export function setHistoryEnabled(on: boolean): void {
  write(ENABLED_KEY, on ? '1' : '0');
}

/** true la primera vez (y la marca como vista). */
export function consumeFirstSaveNotice(): boolean {
  if (read(NOTICE_KEY) === '1') return false;
  write(NOTICE_KEY, '1');
  return true;
}
