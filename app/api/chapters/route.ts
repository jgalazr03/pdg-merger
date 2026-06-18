import { NextResponse } from 'next/server';
import type { Chapter } from '@/lib/chapters';
import { rejectCrossOrigin } from '@/lib/api-guard';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MODEL = 'claude-haiku-4-5-20251001';
const MAX_CHARS = 200_000;

const SYSTEM = `Divides la transcripción de un audio en capítulos temáticos, en español. Reglas:
- Cada línea de la transcripción empieza con su marca de tiempo en SEGUNDOS entre corchetes, p. ej. "[45] ...". El "time" de cada capítulo es ese número (segundos) donde empieza el tema.
- El primer capítulo empieza en 0. Los capítulos van en orden y no se solapan.
- Título corto (máx. ~6 palabras) y una frase de resumen. Fiel a la transcripción: no inventes.
- Ajusta la cantidad al contenido: pocos capítulos si es corto o monotemático, más si es largo y variado (orientativo: 2 a 12).`;

const TOOL = {
  name: 'emitir_capitulos',
  description: 'Entrega los capítulos temáticos de la grabación con su tiempo de inicio.',
  input_schema: {
    type: 'object',
    properties: {
      chapters: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            time: {
              type: 'number',
              description: 'Inicio en segundos (el número entre corchetes).',
            },
            title: { type: 'string', description: 'Título corto del tema.' },
            summary: { type: 'string', description: 'Una frase que resume el capítulo.' },
          },
          required: ['time', 'title', 'summary'],
        },
      },
    },
    required: ['chapters'],
  },
} as const;

/**
 * Genera los capítulos de la grabación. Recibe { transcript } (texto con tiempos
 * en segundos), nunca el audio. La API key vive solo aquí.
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

  let transcript: string | undefined;
  try {
    ({ transcript } = await request.json());
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido.' }, { status: 400 });
  }
  if (!transcript?.trim()) {
    return NextResponse.json(
      { error: 'Falta la transcripción.' },
      { status: 400 }
    );
  }

  const content =
    transcript.length > MAX_CHARS ? transcript.slice(0, MAX_CHARS) : transcript;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1500,
        system: SYSTEM,
        tools: [TOOL],
        tool_choice: { type: 'tool', name: 'emitir_capitulos' },
        messages: [
          { role: 'user', content: `Transcripción:\n\n${content}` },
        ],
      }),
    });

    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300);
      return NextResponse.json(
        { error: `El servicio respondió ${res.status}.`, detail },
        { status: 502 }
      );
    }

    const data = await res.json();
    const block = Array.isArray(data?.content)
      ? data.content.find(
          (b: { type?: string; name?: string }) =>
            b.type === 'tool_use' && b.name === 'emitir_capitulos'
        )
      : undefined;

    if (!block?.input) {
      return NextResponse.json(
        { error: 'No se pudieron generar los capítulos.' },
        { status: 502 }
      );
    }

    const chapters = (block.input.chapters ?? []) as Chapter[];
    return NextResponse.json({ chapters });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || 'Error al generar capítulos.' },
      { status: 500 }
    );
  }
}
