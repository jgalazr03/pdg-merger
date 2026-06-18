import { NextResponse } from 'next/server';
import type { MeetingAnalysis } from '@/lib/analysis';
import { rejectCrossOrigin } from '@/lib/api-guard';
import { upstreamError, serviceError } from '@/lib/upstream';

export const runtime = 'nodejs';
// Analizar una transcripción larga con Claude puede tomar decenas de segundos.
export const maxDuration = 120;

// Haiku 4.5: el más rápido de la familia; de sobra para analizar una reunión.
const MODEL = 'claude-haiku-4-5-20251001';
const MAX_CHARS = 200_000;

const SYSTEM = `Eres un analista que convierte la transcripción de una reunión o llamada en un análisis accionable, en español.
Tu trabajo:
- Detecta el TIPO de encuentro (reunión de trabajo, llamada con cliente, entrevista, etc.).
- Extrae TEMAS tratados, DECISIONES tomadas, COMPROMISOS (acciones concretas, con responsable y plazo si se mencionaron) y PENDIENTES o riesgos sin resolver.
- Evalúa el TONO general del encuentro en una palabra, con una frase que lo justifique.
Sé fiel a la transcripción: no inventes nombres, cifras, fechas ni acuerdos que no aparezcan. Si un dato no se menciona (p. ej. el responsable o el plazo de un compromiso), déjalo nulo. Escribe en español neutro y conciso.`;

const TOOL = {
  name: 'emitir_analisis',
  description: 'Entrega el análisis estructurado de la reunión o llamada.',
  input_schema: {
    type: 'object',
    properties: {
      titulo: {
        type: 'string',
        description: 'Título corto (máx. ~8 palabras) del encuentro.',
      },
      tipo: {
        type: 'string',
        description: 'Tipo de encuentro: "reunión de trabajo", "llamada con cliente", etc.',
      },
      resumen: { type: 'string', description: 'Síntesis en 2 a 4 frases.' },
      temas: {
        type: 'array',
        items: { type: 'string' },
        description: 'Temas tratados, como viñetas breves.',
      },
      decisiones: {
        type: 'array',
        items: { type: 'string' },
        description: 'Decisiones tomadas. Vacío si no aplica.',
      },
      compromisos: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            descripcion: { type: 'string' },
            responsable: { type: ['string', 'null'] },
            plazo: { type: ['string', 'null'] },
          },
          required: ['descripcion'],
        },
        description:
          'Acciones concretas acordadas, con responsable y plazo si se mencionaron (si no, nulos). Vacío si no aplica.',
      },
      pendientes: {
        type: 'array',
        items: { type: 'string' },
        description: 'Dudas, temas sin cerrar o riesgos. Vacío si no aplica.',
      },
      sentimiento: {
        type: 'object',
        properties: {
          etiqueta: {
            type: 'string',
            description: 'Tono en una palabra: "positivo", "neutral", "tenso"…',
          },
          nota: { type: 'string', description: 'Frase que justifica el tono.' },
        },
        required: ['etiqueta', 'nota'],
      },
    },
    required: [
      'titulo',
      'tipo',
      'resumen',
      'temas',
      'decisiones',
      'compromisos',
      'pendientes',
      'sentimiento',
    ],
  },
} as const;

/**
 * Analiza una transcripción (reunión/llamada) con Claude. Recibe { text } (no
 * audio), así que sirve para los dos modos. La API key vive solo aquí.
 */
export async function POST(request: Request) {
  const blocked = rejectCrossOrigin(request);
  if (blocked) return blocked;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'El análisis no está configurado (falta ANTHROPIC_API_KEY).' },
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
    return NextResponse.json({ error: 'Falta el texto a analizar.' }, { status: 400 });
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
        tool_choice: { type: 'tool', name: 'emitir_analisis' },
        messages: [
          {
            role: 'user',
            content: `Analiza esta transcripción:\n\n${content}`,
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
            b.type === 'tool_use' && b.name === 'emitir_analisis'
        )
      : undefined;

    if (!block?.input) {
      return NextResponse.json(
        { error: 'No se pudo generar el análisis.' },
        { status: 502 }
      );
    }

    const analysis = block.input as MeetingAnalysis;
    return NextResponse.json({ analysis, truncated });
  } catch (err) {
    return serviceError(err);
  }
}
