import { NextResponse } from 'next/server';

/**
 * Capa base anti-abuso para los endpoints de pago (Claude / Deepgram / Blob):
 * solo acepta peticiones originadas en el propio sitio. Los `fetch` del
 * navegador a same-origin envían `Origin` con nuestro host; una llamada externa
 * (curl, otro sitio, bot) no coincide y se rechaza con 403.
 *
 * No es infalible —`Origin` es falsificable desde un cliente que no sea
 * navegador— pero corta el abuso oportunista sin depender de un store de
 * rate-limit. Para un límite duro por IP haría falta Upstash/Vercel KV.
 */
export function rejectCrossOrigin(request: Request): NextResponse | null {
  const host =
    request.headers.get('x-forwarded-host') || request.headers.get('host');
  const source = request.headers.get('origin') || request.headers.get('referer');

  let sourceHost: string | null = null;
  if (source) {
    try {
      sourceHost = new URL(source).host;
    } catch {
      sourceHost = null;
    }
  }

  if (host && sourceHost && sourceHost === host) return null;

  return NextResponse.json({ error: 'Origen no autorizado.' }, { status: 403 });
}
