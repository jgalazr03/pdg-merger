// Análisis de una reunión o llamada (módulo Medios). El servidor (Claude) emite
// la parte cualitativa vía tool use (JSON garantizado); las métricas de
// participación (talk-time) se calculan en el cliente a partir de los
// timestamps + diarización de los chunks, sin gastar IA. Tipo compartido.

import type { Chunk } from './transcript';
import { endOf, speakerLabel } from './transcript';

export type Compromiso = {
  descripcion: string;
  /** Quién queda a cargo, si se mencionó. */
  responsable?: string | null;
  /** Fecha o plazo, si se mencionó (texto libre: "el viernes", "fin de mes"). */
  plazo?: string | null;
};

export type Sentimiento = {
  /** Tono general en una palabra: "positivo", "neutral", "tenso"… */
  etiqueta: string;
  /** Una frase que lo justifica. */
  nota: string;
};

export type MeetingAnalysis = {
  /** Título corto del encuentro. */
  titulo: string;
  /** Tipo detectado: "reunión de trabajo", "llamada con cliente", etc. */
  tipo: string;
  /** Síntesis en 2-4 frases. */
  resumen: string;
  /** Temas tratados (viñetas breves). */
  temas: string[];
  /** Decisiones tomadas (vacío si no aplica). */
  decisiones: string[];
  /** Compromisos/acciones con responsable y plazo si se mencionaron. */
  compromisos: Compromiso[];
  /** Pendientes, dudas o riesgos sin resolver. */
  pendientes: string[];
  /** Tono general del encuentro. */
  sentimiento: Sentimiento;
};

export type SpeakerStat = {
  speaker: number;
  label: string;
  /** Segundos hablados (estimado por la duración de sus fragmentos). */
  seconds: number;
  /** Proporción del tiempo total (0-1). */
  share: number;
};

export type TalkTime = {
  speakers: SpeakerStat[];
  totalSeconds: number;
  /** ¿La grabación trae diarización útil (2+ hablantes)? */
  diarized: boolean;
};

/**
 * Reparto de participación por hablante, calculado localmente sumando la
 * duración de los fragmentos de cada quien (no requiere IA). Si no hubo
 * diarización (un solo hablante), `diarized` es false y se usa solo el total.
 */
export function talkTime(chunks: Chunk[]): TalkTime {
  const totals = new Map<number, number>();
  let total = 0;
  chunks.forEach((c, i) => {
    const start = c.timestamp[0] ?? 0;
    const end = endOf(chunks, i);
    const dur = Math.max(0, end - start);
    const sp = c.speaker ?? 0;
    totals.set(sp, (totals.get(sp) ?? 0) + dur);
    total += dur;
  });
  const speakers: SpeakerStat[] = Array.from(totals.entries())
    .map(([speaker, seconds]) => ({
      speaker,
      label: speakerLabel(speaker),
      seconds,
      share: total ? seconds / total : 0,
    }))
    .sort((a, b) => b.seconds - a.seconds);
  return { speakers, totalSeconds: total, diarized: speakers.length > 1 };
}

/** Serializa el análisis a Markdown para copiar o descargar (omite vacíos). */
export function analysisToText(a: MeetingAnalysis): string {
  const parts: string[] = [`# ${a.titulo}`.trim()];
  if (a.tipo) parts.push(`_${a.tipo}_`);
  parts.push('', a.resumen.trim());

  if (a.temas.length) {
    parts.push('', '## Temas', ...a.temas.map((t) => `- ${t.trim()}`));
  }
  if (a.decisiones.length) {
    parts.push('', '## Decisiones', ...a.decisiones.map((d) => `- ${d.trim()}`));
  }
  if (a.compromisos.length) {
    parts.push(
      '',
      '## Compromisos',
      ...a.compromisos.map((c) => {
        const who = c.responsable ? ` — ${c.responsable.trim()}` : '';
        const when = c.plazo ? ` (${c.plazo.trim()})` : '';
        return `- ${c.descripcion.trim()}${who}${when}`;
      })
    );
  }
  if (a.pendientes.length) {
    parts.push('', '## Pendientes', ...a.pendientes.map((p) => `- ${p.trim()}`));
  }
  if (a.sentimiento?.etiqueta) {
    parts.push('', '## Tono', `${a.sentimiento.etiqueta}: ${a.sentimiento.nota}`.trim());
  }
  return parts.join('\n');
}
