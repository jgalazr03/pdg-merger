import { NextResponse } from 'next/server';
import type { Answer } from '@/lib/ask';
import { rejectCrossOrigin } from '@/lib/api-guard';
import { fetchWithRetry, upstreamError, serviceError } from '@/lib/upstream';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MODEL = 'claude-haiku-4-5-20251001';
const MAX_CHARS = 200_000;

const SYSTEM = `Respondes preguntas SOBRE el contenido de la transcripción de un audio, en español. Reglas:
- Usa SOLO información presente en la transcripción. Si la respuesta no aparece, devuelve found=false y dilo con amabilidad (no inventes).
- Cada línea de la transcripción empieza con su marca de tiempo en SEGUNDOS entre corchetes, p. ej. "[45] ...". En "citations" incluye el tiempo (ese número en segundos) de los fragmentos que respaldan tu respuesta, con una cita breve del texto.
- Sé conciso y directo. Cita 1 a 3 momentos como máximo, los más relevantes.`;

const TOOL = {
  name: 'responder',
  description: 'Responde la pregunta sobre la transcripción, citando los momentos del audio que la respaldan.',
  input_schema: {
    type: 'object',
    properties: {
      found: {
        type: 'boolean',
        description: 'true si la respuesta está en la transcripción.',
      },
      answer: {
        type: 'string',
        description: 'Respuesta en español, basada solo en la transcripción.',
      },
      citations: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            time: {
              type: 'number',
              description: 'Segundos (el número entre corchetes de la línea citada).',
            },
            quote: { type: 'string', description: 'Fragmento breve citado.' },
          },
          required: ['time', 'quote'],
        },
        description: 'Momentos que respaldan la respuesta. Vacío si found=false.',
      },
    },
    required: ['found', 'answer', 'citations'],
  },
} as const;

/**
 * "Pregúntale a tu grabación": responde una pregunta sobre la transcripción y
 * cita los momentos exactos. Recibe { question, transcript } (texto con tiempos
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

  let question: string | undefined;
  let transcript: string | undefined;
  try {
    ({ question, transcript } = await request.json());
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido.' }, { status: 400 });
  }
  if (!question?.trim() || !transcript?.trim()) {
    return NextResponse.json(
      { error: 'Falta la pregunta o la transcripción.' },
      { status: 400 }
    );
  }

  const content =
    transcript.length > MAX_CHARS ? transcript.slice(0, MAX_CHARS) : transcript;

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
        max_tokens: 1024,
        system: SYSTEM,
        tools: [TOOL],
        tool_choice: { type: 'tool', name: 'responder' },
        messages: [
          {
            role: 'user',
            // La transcripción (lo más pesado y constante entre preguntas) va en
            // un bloque con cache_control: Anthropic la cachea y la reutiliza en
            // las siguientes preguntas sobre la misma grabación (~10× menos coste
            // y menos presión de tokens/min). La pregunta, que cambia, va en otro
            // bloque sin cachear. El caching es GA, no requiere beta header.
            content: [
              {
                type: 'text',
                text: `Transcripción:\n\n${content}`,
                cache_control: { type: 'ephemeral' },
              },
              { type: 'text', text: `---\nPregunta: ${question}` },
            ],
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
            b.type === 'tool_use' && b.name === 'responder'
        )
      : undefined;

    if (!block?.input) {
      return NextResponse.json(
        { error: 'No se pudo responder.' },
        { status: 502 }
      );
    }

    return NextResponse.json({ answer: block.input as Answer });
  } catch (err) {
    return serviceError(err);
  }
}
