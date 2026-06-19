import { NextResponse } from 'next/server';
import { rejectCrossOrigin } from '@/lib/api-guard';
import { upstreamError, serviceError } from '@/lib/upstream';

export const runtime = 'nodejs';
export const maxDuration = 120;

const MODEL = 'claude-haiku-4-5-20251001';
const MAX_CHARS = 200_000;

type Kind =
  | 'acta'
  | 'correo'
  | 'post'
  | 'memo-auditoria'
  | 'minuta-fiscal'
  | 'cobranza';

const KIND_INSTRUCTIONS: Record<Kind, string> = {
  acta: 'Redacta un ACTA DE REUNIÓN formal en español, en Markdown: un título, fecha si se menciona, asistentes si se infieren, los temas tratados, los acuerdos (decisiones), las tareas con su responsable y, al final, los próximos pasos. Estructúrala con encabezados y listas.',
  correo:
    'Redacta un CORREO DE SEGUIMIENTO en español, en Markdown: una línea de "Asunto:", un saludo, un párrafo breve con lo tratado, una lista con los acuerdos y tareas (con responsables), y un cierre cordial. Tono profesional y conciso.',
  post: 'Redacta una PUBLICACIÓN para redes (estilo LinkedIn) en español, en Markdown: un gancho inicial, 2-4 ideas clave del contenido en un tono cercano y profesional, y un cierre con una reflexión o llamado a la acción. Puedes usar alguna lista. Evita inventar datos.',
  'memo-auditoria':
    'Redacta un MEMORÁNDUM DE AUDITORÍA en español, en Markdown, con foco en los elementos relevantes para la auditoría tratados en la reunión. Usa encabezados y agrupa por: Deuda y financiamientos nuevos; Partes relacionadas; Litigios y contingencias; Cambios operativos o contables (políticas, estimaciones, juicios); Eventos posteriores; Otros riesgos de revelación. En cada apartado resume SOLO lo que se dijo; si un apartado relevante no se abordó, indícalo como "No se abordó en la reunión". Cierra con "Puntos de seguimiento para papeles de trabajo" (lista, con responsable si se mencionó). No inventes cifras ni hechos.',
  'minuta-fiscal':
    'Redacta una MINUTA FISCAL en español, en Markdown, centrada en obligaciones y plazos. Incluye: un breve resumen; "Obligaciones y trámites" (lista); "Plazos y fechas" (lista con la fecha o vencimiento mencionado —p. ej. ante el SAT— y el responsable); "Impuestos y conceptos" involucrados (ISR, IVA, etc., solo los mencionados); "Documentación requerida" (CFDI, papeles de trabajo, etc.); "Pendientes y riesgos fiscales"; y "Próximos pasos" con fecha si se dijo. Extrae con cuidado cualquier fecha o plazo. No inventes fechas, montos ni obligaciones que no se hayan mencionado.',
  cobranza:
    'Redacta un RESUMEN DE LLAMADA DE COBRANZA en español, en Markdown. Incluye: "Datos de la gestión" (cliente/cuenta, monto y estatus si se mencionan); "Resumen de la conversación"; "Compromiso de pago" (monto y fecha acordados, si los hay); "Acuerdos y próximos pasos". Agrega una sección "Cumplimiento" donde señales ÚNICAMENTE las situaciones evidentes en la transcripción que pudieran implicar riesgo (p. ej. lenguaje ofensivo o amenazante, falta de identificación del gestor, llamada fuera de horario, falta de trato digno o de aviso de privacidad). Si no detectas señales, escribe "Sin señales de incumplimiento detectadas". No infieras incumplimientos que no estén respaldados por lo dicho.',
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
