import { NextResponse } from 'next/server';
import { del } from '@vercel/blob';

export const runtime = 'nodejs';
// Deepgram batch procesa ~30× tiempo real; 300 s cubre audios de varias horas.
export const maxDuration = 300;

const DG_PARAMS = new URLSearchParams({
  model: 'nova-3',
  language: 'es',
  smart_format: 'true',
  punctuate: 'true',
  utterances: 'true',
}).toString();

interface Utterance {
  start: number;
  end: number;
  transcript: string;
}

/**
 * Modo servidor (Deepgram Nova-3). Recibe la URL de un blob (subido por el
 * cliente a Vercel Blob), pide a Deepgram que lo transcriba por URL, normaliza
 * la salida a { text, chunks } y borra el blob. La API key vive solo aquí
 * (variable de entorno), nunca en el cliente.
 */
export async function POST(request: Request) {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'El modo servidor no está configurado (falta DEEPGRAM_API_KEY).' },
      { status: 500 }
    );
  }

  let url: string | undefined;
  try {
    ({ url } = await request.json());
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido.' }, { status: 400 });
  }
  if (!url) {
    return NextResponse.json({ error: 'Falta la URL del audio.' }, { status: 400 });
  }

  try {
    const dg = await fetch(`https://api.deepgram.com/v1/listen?${DG_PARAMS}`, {
      method: 'POST',
      headers: {
        Authorization: `Token ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
    });

    if (!dg.ok) {
      const detail = (await dg.text()).slice(0, 300);
      return NextResponse.json(
        { error: `Deepgram respondió ${dg.status}.`, detail },
        { status: 502 }
      );
    }

    const data = await dg.json();
    const alt = data?.results?.channels?.[0]?.alternatives?.[0];
    const text: string = (alt?.transcript ?? '').trim();
    const utterances: Utterance[] = data?.results?.utterances ?? [];
    const chunks = utterances.map((u) => ({
      timestamp: [u.start, u.end] as [number, number],
      text: (u.transcript ?? '').trim(),
    }));

    return NextResponse.json({ text, chunks });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || 'Error al transcribir.' },
      { status: 500 }
    );
  } finally {
    // Limpieza del blob temporal (no rompe la respuesta si falla).
    await del(url).catch(() => {});
  }
}
