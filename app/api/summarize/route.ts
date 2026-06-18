import { NextResponse } from 'next/server';
import type { Minuta } from '@/lib/summary';
import { rejectCrossOrigin } from '@/lib/api-guard';

export const runtime = 'nodejs';
// Resumir una transcripción larga con Claude puede tomar decenas de segundos.
export const maxDuration = 120;

// Haiku 4.5: el más rápido de la familia; de sobra para resumir/minutar una
// transcripción, con mucha menor latencia que Sonnet/Opus.
const MODEL = 'claude-haiku-4-5-20251001';
// Cota defensiva: ~200k caracteres (~50k tokens) cubre audios de varias horas y
// deja margen de contexto. Por encima, se recorta y se avisa.
const MAX_CHARS = 200_000;

const SYSTEM = `Eres un asistente que redacta resúmenes y minutas claras en español a partir de la transcripción de un audio.
Adáptate al tipo de contenido:
- Si es una reunión o llamada de trabajo: extrae los acuerdos (decisiones tomadas) y las tareas/pendientes, con responsable si se menciona.
- Si es una clase, entrevista, conferencia o nota de voz: deja "acuerdos" y "tareas" vacíos y concéntrate en el resumen y los puntos clave.
Sé fiel a la transcripción: no inventes datos, nombres ni cifras que no aparezcan. Escribe en español neutro y conciso.`;

const TOOL = {
  name: 'emitir_minuta',
  description: 'Entrega el resumen estructurado de la transcripción.',
  input_schema: {
    type: 'object',
    properties: {
      titulo: {
        type: 'string',
        description: 'Título corto (máx. ~8 palabras) que describe el audio.',
      },
      resumen: {
        type: 'string',
        description: 'Síntesis en 2 a 4 frases.',
      },
      puntosClave: {
        type: 'array',
        items: { type: 'string' },
        description: 'Ideas o temas principales, como viñetas breves.',
      },
      acuerdos: {
        type: 'array',
        items: { type: 'string' },
        description: 'Decisiones tomadas. Vacío si no aplica.',
      },
      tareas: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            descripcion: { type: 'string' },
            responsable: { type: ['string', 'null'] },
          },
          required: ['descripcion'],
        },
        description: 'Pendientes/acciones con responsable si se mencionó. Vacío si no aplica.',
      },
    },
    required: ['titulo', 'resumen', 'puntosClave', 'acuerdos', 'tareas'],
  },
} as const;

/**
 * Genera una minuta/resumen de la transcripción con Claude. Recibe { text }
 * (no audio), así que sirve para ambos modos. La API key vive solo aquí.
 */
export async function POST(request: Request) {
  const blocked = rejectCrossOrigin(request);
  if (blocked) return blocked;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'El resumen no está configurado (falta ANTHROPIC_API_KEY).' },
      { status: 500 }
    );
  }

  let text: string | undefined;
  try {
    ({ text } = await request.json());
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido.' }, { status: 400 });
  }
  if (!text || !text.trim()) {
    return NextResponse.json({ error: 'Falta el texto a resumir.' }, { status: 400 });
  }

  const truncated = text.length > MAX_CHARS;
  const content = truncated ? text.slice(0, MAX_CHARS) : text;

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
        max_tokens: 2048,
        system: SYSTEM,
        tools: [TOOL],
        tool_choice: { type: 'tool', name: 'emitir_minuta' },
        messages: [
          {
            role: 'user',
            content: `Resume esta transcripción:\n\n${content}`,
          },
        ],
      }),
    });

    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300);
      return NextResponse.json(
        { error: `El servicio de resumen respondió ${res.status}.`, detail },
        { status: 502 }
      );
    }

    const data = await res.json();
    const block = Array.isArray(data?.content)
      ? data.content.find(
          (b: { type?: string; name?: string }) =>
            b.type === 'tool_use' && b.name === 'emitir_minuta'
        )
      : undefined;

    if (!block?.input) {
      return NextResponse.json(
        { error: 'No se pudo generar el resumen.' },
        { status: 502 }
      );
    }

    const minuta = block.input as Minuta;
    return NextResponse.json({ minuta, truncated });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || 'Error al generar el resumen.' },
      { status: 500 }
    );
  }
}
