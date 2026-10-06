// Esquema del historial local de Medios (IndexedDB). Todo lo que se lee de la
// base se valida aquí: un registro corrupto o de una versión futura se descarta
// en lugar de romper la UI. La forma está pensada para poder migrarse tal cual a
// un backend (Suite) más adelante: ids estables, fechas ISO, sin referencias a
// objetos del navegador.
import { z } from 'zod';

export const SCHEMA_VERSION = 1;

export const chunkSchema = z.object({
  timestamp: z.tuple([z.number(), z.number().nullable()]),
  text: z.string(),
  speaker: z.number().optional(),
});

export const speakerNamesSchema = z.record(z.string(), z.string());

/** Metadatos ligeros para listar sin cargar la transcripción completa. */
export const sessionMetaSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  id: z.string().min(1),
  /** Nombre visible (por defecto, el nombre del archivo sin extensión). */
  title: z.string(),
  /** Herramienta que la creó (transcribir, analizar-reunion…). */
  tool: z.string(),
  mode: z.enum(['local', 'server']),
  /** Huella del archivo original para reconectar el audio sin guardarlo. */
  media: z.object({
    name: z.string(),
    size: z.number(),
    type: z.string(),
    lastModified: z.number(),
  }),
  /** Duración en segundos según la transcripción. */
  duration: z.number(),
  chunkCount: z.number(),
  speakerCount: z.number(),
  /** Tipos de resultado de IA guardados (para las insignias de la lista). */
  aiKinds: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type SessionMeta = z.infer<typeof sessionMetaSchema>;

export const transcriptRecordSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  id: z.string().min(1),
  chunks: z.array(chunkSchema),
  /** Texto plano: solo relevante si no hubo segmentos (`chunks` vacío). */
  text: z.string(),
  speakerNames: speakerNamesSchema,
});
export type TranscriptRecord = z.infer<typeof transcriptRecordSchema>;

// ---------- Resultados de IA ----------

const tareaSchema = z.object({
  descripcion: z.string(),
  responsable: z.string().nullable().optional(),
});

const minutaSchema = z.object({
  titulo: z.string(),
  resumen: z.string(),
  puntosClave: z.array(z.string()),
  acuerdos: z.array(z.string()),
  tareas: z.array(tareaSchema),
});

const analysisSchema = z.object({
  titulo: z.string(),
  tipo: z.string(),
  resumen: z.string(),
  temas: z.array(z.string()),
  decisiones: z.array(z.string()),
  compromisos: z.array(
    z.object({
      descripcion: z.string(),
      responsable: z.string().nullable().optional(),
      plazo: z.string().nullable().optional(),
    })
  ),
  pendientes: z.array(z.string()),
  sentimiento: z.object({ etiqueta: z.string(), nota: z.string() }),
});

const chapterSchema = z.object({
  time: z.number(),
  title: z.string(),
  summary: z.string(),
});

const answerSchema = z.object({
  found: z.boolean(),
  answer: z.string(),
  citations: z.array(z.object({ time: z.number(), quote: z.string() })),
});

/** Un tipo de resultado y la forma de su `payload`. `variant` distingue varios
 *  resultados del mismo tipo (un entregable por plantilla, una traducción por
 *  idioma); es '' cuando el tipo tiene uno solo. */
export const aiPayloadSchemas = {
  summary: z.object({ minuta: minutaSchema, truncated: z.boolean() }),
  analysis: z.object({ analysis: analysisSchema, truncated: z.boolean() }),
  chapters: z.object({ chapters: z.array(chapterSchema) }),
  deliverable: z.object({ content: z.string() }),
  /** Textos traducidos por índice de segmento (los tiempos son los originales). */
  translation: z.object({ texts: z.array(z.string()), truncated: z.boolean() }),
  ask: z.object({
    turns: z.array(
      z.object({
        question: z.string(),
        answer: answerSchema.optional(),
        error: z.string().optional(),
      })
    ),
  }),
  suggestions: z.object({ questions: z.array(z.string()) }),
} as const;

export type AiKind = keyof typeof aiPayloadSchemas;
export type AiPayload<K extends AiKind> = z.infer<(typeof aiPayloadSchemas)[K]>;
export const AI_KINDS = Object.keys(aiPayloadSchemas) as AiKind[];

const aiResultBase = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  sessionId: z.string().min(1),
  kind: z.enum(AI_KINDS as [AiKind, ...AiKind[]]),
  variant: z.string(),
  /** Huella del contenido con el que se generó (ver hash.ts). */
  sourceHash: z.string(),
  createdAt: z.string(),
  payload: z.unknown(),
});

export type AiResult<K extends AiKind = AiKind> = {
  schemaVersion: typeof SCHEMA_VERSION;
  sessionId: string;
  kind: K;
  variant: string;
  sourceHash: string;
  createdAt: string;
  payload: AiPayload<K>;
};

/** Valida un resultado leído de la base (envoltorio + payload según su tipo). */
export function parseAiResult(raw: unknown): AiResult | null {
  const base = aiResultBase.safeParse(raw);
  if (!base.success) return null;
  const payload = aiPayloadSchemas[base.data.kind].safeParse(base.data.payload);
  if (!payload.success) return null;
  return { ...base.data, payload: payload.data } as AiResult;
}

/** Clave compuesta de un resultado dentro de una sesión. */
export function resultKey(kind: AiKind, variant = ''): string {
  return variant ? `${kind}:${variant}` : kind;
}
