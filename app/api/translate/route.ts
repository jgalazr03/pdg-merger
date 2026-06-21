import { NextResponse } from 'next/server';
import { rejectCrossOrigin } from '@/lib/api-guard';
import { fetchWithRetry, upstreamError, serviceError } from '@/lib/upstream';

export const runtime = 'nodejs';
export const maxDuration = 120;

const MODEL = 'claude-haiku-4-5-20251001';
// Cota por llamada: traducir conserva ~1:1 el tamaño, así que limitamos el texto
// de entrada para no exceder el output. Lo que sobre se marca como truncado.
const MAX_CHARS = 16000;

const SYSTEM = `Traduces subtítulos. Recibes segmentos numerados "[i] texto" y un idioma destino. Devuelve la traducción de CADA segmento al idioma destino conservando su mismo "i". Traduce de forma natural y concisa, apta para subtítulos. Un segmento de entrada = un segmento de salida (no fusiones ni dividas). No traduzcas nombres propios.`;

const TOOL = {
  name: 'traducir',
  description: 'Devuelve la traducción de cada segmento, conservando su índice.',
  input_schema: {
    type: 'object',
    properties: {
      translations: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            i: { type: 'number', description: 'Índice del segmento original.' },
            text: { type: 'string', description: 'Traducción del segmento.' },
          },
          required: ['i', 'text'],
        },
      },
    },
    required: ['translations'],
  },
} as const;

interface Segment {
  i: number;
  text: string;
}

/**
 * Traduce los segmentos de la transcripción a otro idioma conservando su índice
 * (para reconstruir subtítulos traducidos con los mismos tiempos). Recibe
 * { segments, target }. La API key vive solo aquí.
 */
export async function POST(request: Request) {
  const blocked = rejectCrossOrigin(request);
  if (blocked) return blocked;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'La función no está configurada (falta ANTHROPIC_API_KEY).' },
      { status: 500 }
    );
  }

  let segments: Segment[] | undefined;
  let target: string | undefined;
  try {
    ({ segments, target } = await request.json());
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido.' }, { status: 400 });
  }
  if (!Array.isArray(segments) || !segments.length || !target?.trim()) {
    return NextResponse.json(
      { error: 'Faltan los segmentos o el idioma.' },
      { status: 400 }
    );
  }

  // Recorta por presupuesto de caracteres (lo demás queda sin traducir).
  const batch: Segment[] = [];
  let chars = 0;
  for (const s of segments) {
    chars += (s.text?.length ?? 0) + 6;
    if (chars > MAX_CHARS) break;
    batch.push({ i: s.i, text: s.text });
  }
  const truncated = batch.length < segments.length;

  try {
    const res = await fetchWithRetry('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 8192,
        system: SYSTEM,
        tools: [TOOL],
        tool_choice: { type: 'tool', name: 'traducir' },
        messages: [
          {
            role: 'user',
            content: `Idioma destino: ${target}\n\nSegmentos:\n${batch
              .map((s) => `[${s.i}] ${s.text}`)
              .join('\n')}`,
          },
        ],
      }),
    });

    if (!res.ok) {
      return upstreamError(res.status, await res.text().catch(() => ''));
    }

    const data = await res.json();
    const block = Array.isArray(data?.content)
      ? data.content.find(
          (b: { type?: string; name?: string }) =>
            b.type === 'tool_use' && b.name === 'traducir'
        )
      : undefined;

    if (!block?.input) {
      return NextResponse.json(
        { error: 'No se pudo traducir.' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      translations: block.input.translations ?? [],
      truncated,
    });
  } catch (err) {
    return serviceError(err);
  }
}
