import { NextResponse } from 'next/server';
import { del } from '@vercel/blob';
import { rejectCrossOrigin } from '@/lib/api-guard';
import { upstreamError, serviceError } from '@/lib/upstream';
import { DOMAIN_KEYTERMS } from '@/lib/keyterms';

export const runtime = 'nodejs';
// Deepgram batch procesa ~30× tiempo real; 300 s cubre audios de varias horas.
export const maxDuration = 300;

// Parámetros de Deepgram + "keyterm prompting" con vocabulario fiscal-contable
// MX (+ términos personalizados del usuario) para subir la precisión en jerga de
// dominio y anglicismos (Spanglish). El keyterm es contextual (no fuerza),
// seguro aunque el audio no sea contable. Límite Deepgram: ~500 tokens;
// recortamos a 100 términos por seguridad.
function buildDgParams(extraTerms: string[]): string {
  const p = new URLSearchParams({
    model: 'nova-3',
    language: 'es',
    smart_format: 'true',
    punctuate: 'true',
    utterances: 'true',
    // Diarización: separa por hablante (útil para reuniones/entrevistas). Cada
    // utterance trae su `speaker` (entero) que el cliente pinta como «Hablante N».
    diarize: 'true',
  });
  const all = Array.from(new Set([...DOMAIN_KEYTERMS, ...extraTerms])).slice(0, 100);
  for (const term of all) p.append('keyterm', term);
  return p.toString();
}

/** Saneo de los términos personalizados que manda el cliente (vocabulario del
 *  despacho): strings no vacíos, recortados, máx 60 chars y hasta 50 términos. */
function sanitizeKeyterms(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((t): t is string => typeof t === 'string')
    .map((t) => t.trim().slice(0, 60))
    .filter(Boolean)
    .slice(0, 50);
}

interface Utterance {
  start: number;
  end: number;
  transcript: string;
  speaker?: number;
}

/**
 * Modo servidor (Deepgram Nova-3). Recibe la URL de un blob (subido por el
 * cliente a Vercel Blob), pide a Deepgram que lo transcriba por URL, normaliza
 * la salida a { text, chunks } y borra el blob. La API key vive solo aquí
 * (variable de entorno), nunca en el cliente.
 */
export async function POST(request: Request) {
  const blocked = rejectCrossOrigin(request);
  if (blocked) return blocked;

  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'El modo servidor no está configurado (falta DEEPGRAM_API_KEY).' },
      { status: 500 }
    );
  }

  let url: string | undefined;
  let keyterms: string[] = [];
  try {
    const body = await request.json();
    url = body?.url;
    keyterms = sanitizeKeyterms(body?.keyterms);
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido.' }, { status: 400 });
  }
  if (!url) {
    return NextResponse.json({ error: 'Falta la URL del audio.' }, { status: 400 });
  }

  try {
    const dg = await fetch(`https://api.deepgram.com/v1/listen?${buildDgParams(keyterms)}`, {
      method: 'POST',
      headers: {
        Authorization: `Token ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
    });

    if (!dg.ok) {
      return upstreamError(dg.status, await dg.text().catch(() => ''));
    }

    const data = await dg.json();
    const alt = data?.results?.channels?.[0]?.alternatives?.[0];
    const text: string = (alt?.transcript ?? '').trim();
    const utterances: Utterance[] = data?.results?.utterances ?? [];
    const chunks = utterances.map((u) => ({
      timestamp: [u.start, u.end] as [number, number],
      text: (u.transcript ?? '').trim(),
      ...(typeof u.speaker === 'number' ? { speaker: u.speaker } : {}),
    }));

    return NextResponse.json({ text, chunks });
  } catch (err) {
    return serviceError(err);
  } finally {
    // Limpieza del blob temporal (no rompe la respuesta si falla).
    await del(url).catch(() => {});
  }
}
