import { NextResponse } from 'next/server';

/**
 * Códigos en los que SÍ reintentar: límite de tasa (429, "mucha demanda"),
 * sobrecarga del proveedor (529) y errores transitorios de servidor/gateway.
 * El resto (400/401/403/404…) son definitivos: reintentarlos no ayuda.
 */
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504, 529]);

interface RetryOptions {
  /** Reintentos máximos, además del primer intento. */
  retries?: number;
  /** Base del backoff exponencial (ms). */
  baseDelayMs?: number;
  /** Tope de espera por intento (ms). */
  maxDelayMs?: number;
  /** Presupuesto total de espera entre reintentos (ms). Acotado por el
   *  `maxDuration` de la ruta para no arriesgar un timeout de la función. */
  budgetMs?: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Resume las cabeceras de rate-limit de la respuesta: `retry-after` + cualquiera
 * que contenga `ratelimit` (cubre las `anthropic-ratelimit-*` de Anthropic y las
 * `x-ratelimit-*` de otros). Sirve para ver en los logs de Vercel si el 429 es
 * saturación pasajera o el cupo de la cuenta agotado (tokens/min restantes).
 */
function rateLimitInfo(res: Response): string {
  const bits: string[] = [];
  const retryAfter = res.headers.get('retry-after');
  if (retryAfter) bits.push(`retry-after=${retryAfter}s`);
  res.headers.forEach((value, name) => {
    if (name.toLowerCase().includes('ratelimit')) bits.push(`${name}=${value}`);
  });
  return bits.length ? bits.join(' ') : '(sin cabeceras de rate-limit)';
}

/** Lee `retry-after` (segundos o fecha HTTP). Devuelve ms, o null si no aplica. */
function retryAfterMs(res: Response): number | null {
  const header = res.headers.get('retry-after');
  if (!header) return null;
  const secs = Number(header);
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
  const when = Date.parse(header);
  return Number.isFinite(when) ? Math.max(0, when - Date.now()) : null;
}

/**
 * `fetch` con reintentos automáticos: backoff exponencial + jitter, respetando
 * la cabecera `retry-after` del proveedor. Absorbe los 429 ("mucha demanda") y
 * 529 (sobrecarga) transitorios de Anthropic/Deepgram para que NO lleguen al
 * usuario: cuesta algún reintento extra a cambio de no fallar al primer rechazo.
 * Se detiene si se agotaría el presupuesto de tiempo (evita exceder el
 * `maxDuration` de la ruta) y devuelve la última respuesta para que el handler
 * la traduzca con `upstreamError`. El `body` de `init` debe ser un string
 * (JSON serializado): así se puede reenviar intacto en cada reintento.
 */
export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  opts: RetryOptions = {}
): Promise<Response> {
  const retries = opts.retries ?? 5;
  const baseDelay = opts.baseDelayMs ?? 500;
  const maxDelay = opts.maxDelayMs ?? 8_000;
  const budget = opts.budgetMs ?? 20_000;
  const start = Date.now();

  let res = await fetch(url, init);
  for (
    let attempt = 0;
    attempt < retries && RETRYABLE_STATUS.has(res.status);
    attempt++
  ) {
    const backoff = Math.min(maxDelay, baseDelay * 2 ** attempt);
    const wait = retryAfterMs(res) ?? backoff + Math.random() * baseDelay;

    // Sin margen dentro del presupuesto: devolvemos el error en vez de
    // arriesgar que la función serverless se quede sin tiempo.
    if (Date.now() - start + wait > budget) break;

    console.warn(
      `[upstream retry ${attempt + 1}/${retries}] ${res.status} ${url} — espera ${Math.round(wait)}ms — ${rateLimitInfo(res)}`
    );
    await res.body?.cancel().catch(() => {});
    await sleep(wait);
    res = await fetch(url, init);
  }

  // Si tras los reintentos seguimos en un código transitorio, dejamos constancia
  // del límite exacto que se topó: con `tokens-remaining` cerca de 0 es cupo de la
  // cuenta (subir de tier); si hay margen, fue saturación pasajera del proveedor.
  if (RETRYABLE_STATUS.has(res.status)) {
    console.error(
      `[upstream agotado] ${res.status} ${url} tras ${Math.round((Date.now() - start) / 1000)}s — ${rateLimitInfo(res)}`
    );
  }
  return res;
}

/**
 * Traduce un fallo de un servicio externo (Anthropic / Deepgram) a un mensaje
 * amigable en español, SIN exponer códigos crudos (p. ej. 429) al usuario. El
 * detalle real se registra en los logs del servidor para depurar.
 */
export function upstreamError(status: number, detail?: string): NextResponse {
  console.error(`[upstream ${status}] ${detail?.slice(0, 200) ?? ''}`);
  const message =
    status === 429
      ? 'Hay mucha demanda en este momento. Espera unos segundos e inténtalo de nuevo.'
      : status === 401 || status === 403
        ? 'La función no está disponible en este momento.'
        : 'No se pudo completar la operación. Inténtalo de nuevo en un momento.';
  return NextResponse.json({ error: message }, { status: 502 });
}

/** Mensaje amigable para errores inesperados (bloques catch). */
export function serviceError(err: unknown): NextResponse {
  console.error('[endpoint error]', err);
  return NextResponse.json(
    {
      error:
        'No se pudo completar la operación. Inténtalo de nuevo en un momento.',
    },
    { status: 500 }
  );
}
