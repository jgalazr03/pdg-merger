import { NextResponse } from 'next/server';
import { rejectCrossOrigin } from '@/lib/api-guard';
import { upstreamError, serviceError } from '@/lib/upstream';

export const runtime = 'nodejs';
export const maxDuration = 120;

const MODEL = 'claude-haiku-4-5-20251001';
const MAX_CHARS = 200_000;

type Kind = 'acta' | 'correo' | 'post';

const KIND_INSTRUCTIONS: Record<Kind, string> = {
  acta: 'Redacta un ACTA DE REUNIÓN formal en español, en Markdown: un título, fecha si se menciona, asistentes si se infieren, los temas tratados, los acuerdos (decisiones), las tareas con su responsable y, al final, los próximos pasos. Estructúrala con encabezados y listas.',
  correo:
    'Redacta un CORREO DE SEGUIMIENTO en español, en Markdown: una línea de "Asunto:", un saludo, un párrafo breve con lo tratado, una lista con los acuerdos y tareas (con responsables), y un cierre cordial. Tono profesional y conciso.',
  post: 'Redacta una PUBLICACIÓN para redes (estilo LinkedIn) en español, en Markdown: un gancho inicial, 2-4 ideas clave del contenido en un tono cercano y profesional, y un cierre con una reflexión o llamado a la acción. Puedes usar alguna lista. Evita inventar datos.',
};

const BASE_SYSTEM =
  'Generas documentos a partir de la transcripción de un audio. Sé fiel a lo que se dijo: no inventes datos, nombres ni cifras. Devuelve SOLO el documento en Markdown, sin preámbulos como "Aquí tienes" ni explicaciones.';

/**
 * Genera un entregable (acta / correo / publicación) a partir de la
 * transcripción. Recibe { transcript, kind }. La API key vive solo aquí.
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
  let kind: Kind | undefined;
  try {
    ({ transcript, kind } = await request.json());
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido.' }, { status: 400 });
  }
  if (!transcript?.trim() || !kind || !(kind in KIND_INSTRUCTIONS)) {
    return NextResponse.json(
      { error: 'Falta la transcripción o el tipo de documento.' },
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
        max_tokens: 3072,
        system: `${BASE_SYSTEM}\n\n${KIND_INSTRUCTIONS[kind]}`,
        messages: [
          { role: 'user', content: `Transcripción:\n\n${content}` },
        ],
      }),
    });

    if (!res.ok) {
      return upstreamError(res.status, await res.text().catch(() => ''));
    }

    const data = await res.json();
    const text: string = Array.isArray(data?.content)
      ? data.content
          .filter((b: { type?: string }) => b.type === 'text')
          .map((b: { text?: string }) => b.text ?? '')
          .join('')
          .trim()
      : '';

    if (!text) {
      return NextResponse.json(
        { error: 'No se pudo generar el documento.' },
        { status: 502 }
      );
    }

    return NextResponse.json({ content: text });
  } catch (err) {
    return serviceError(err);
  }
}
