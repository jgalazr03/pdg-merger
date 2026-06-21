import { NextResponse } from 'next/server';
import { rejectCrossOrigin } from '@/lib/api-guard';
import { fetchWithRetry, upstreamError, serviceError } from '@/lib/upstream';

export const runtime = 'nodejs';
export const maxDuration = 30;

const MODEL = 'claude-haiku-4-5-20251001';
const MAX_CHARS = 40000;

const SYSTEM = `Generas 3 preguntas breves y concretas que una persona se haría sobre el contenido de esta grabación, en español. Básate en lo que REALMENTE se trató (temas, decisiones, datos, personas). Naturales y cortas (máximo ~9 palabras), específicas a esta grabación, no genéricas.`;

const TOOL = {
  name: 'sugerir_preguntas',
  description: 'Entrega 3 preguntas sugeridas, específicas al contenido.',
  input_schema: {
    type: 'object',
    properties: {
      questions: {
        type: 'array',
        items: { type: 'string' },
        description: 'Exactamente 3 preguntas breves en español.',
      },
    },
    required: ['questions'],
  },
} as const;

/**
 * Sugerencias de preguntas para "Pregúntale a tu grabación", generadas a partir
 * del contenido (no fijas). Recibe { transcript }. La API key vive solo aquí.
 */
export async function POST(request: Request) {
  const blocked = rejectCrossOrigin(request);
  if (blocked) return blocked;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ questions: [] });
  }

  let transcript: string | undefined;
  try {
    ({ transcript } = await request.json());
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido.' }, { status: 400 });
  }
  if (!transcript?.trim()) {
    return NextResponse.json({ questions: [] });
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
        max_tokens: 512,
        system: SYSTEM,
        tools: [TOOL],
        tool_choice: { type: 'tool', name: 'sugerir_preguntas' },
        messages: [{ role: 'user', content: `Transcripción:\n\n${content}` }],
      }),
    });

    if (!res.ok) {
      return upstreamError(res.status, await res.text().catch(() => ''));
    }

    const data = await res.json();
    const block = Array.isArray(data?.content)
      ? data.content.find(
          (b: { type?: string; name?: string }) =>
            b.type === 'tool_use' && b.name === 'sugerir_preguntas'
        )
      : undefined;

    const questions: string[] = Array.isArray(block?.input?.questions)
      ? block.input.questions.slice(0, 3)
      : [];
    return NextResponse.json({ questions });
  } catch (err) {
    return serviceError(err);
  }
}
