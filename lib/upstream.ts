import { NextResponse } from 'next/server';

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
