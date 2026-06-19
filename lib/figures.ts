// Extrae las CIFRAS mencionadas (montos y porcentajes) de la transcripción, con
// su marca de tiempo, para verificarlas contra el audio. Es read-only y additive
// (NO reescribe la transcripción: auto-corregir cifras financieras es riesgoso y
// Deepgram smart_format ya las formatea). Pensado para revisión/auditoría: "estas
// son las cifras que se dijeron, toca cada una para escucharla".

import type { Chunk } from './transcript';

export type Figure = {
  /** Texto tal como aparece (p. ej. "$1,250,000", "15%"). */
  text: string;
  /** Inicio del segmento donde se dijo (segundos) para saltar el reproductor. */
  time: number;
  kind: 'monto' | 'porcentaje';
};

// Solo detectamos números CON contexto de moneda o porcentaje (evita capturar
// folios, RFC, teléfonos o años sueltos). Best-effort: el usuario verifica.
const PATTERNS: { re: RegExp; kind: Figure['kind'] }[] = [
  // $ con opcional escala/moneda: "$1,250,000", "$5 millones", "$3 mdp"
  { re: /\$\s?\d[\d.,]*(?:\s?(?:millones?|mil millones|mil|mdp|mdd|de pesos|de d[oó]lares))?/gi, kind: 'monto' },
  // número + escala + moneda: "5 millones de pesos", "300 mil dólares"
  { re: /\d[\d.,]*\s?(?:millones?|mil millones|mil)\s?de\s?(?:pesos|d[oó]lares)/gi, kind: 'monto' },
  // número + moneda directa: "50,000 pesos", "1200 MXN", "3 mdp"
  { re: /\d[\d.,]*\s?(?:pesos|mxn|usd|d[oó]lares|mdp|mdd)\b/gi, kind: 'monto' },
  // porcentaje: "15%", "3.5 por ciento"
  { re: /\d[\d.,]*\s?(?:%|por ciento)/gi, kind: 'porcentaje' },
];

/** Cifras (montos/porcentajes) por orden de aparición, sin solapamientos. */
export function extractFigures(chunks: Chunk[]): Figure[] {
  const out: Figure[] = [];
  for (const c of chunks) {
    const time = c.timestamp[0] ?? 0;
    const hits: { start: number; end: number; text: string; kind: Figure['kind'] }[] = [];
    for (const { re, kind } of PATTERNS) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(c.text))) {
        hits.push({ start: m.index, end: m.index + m[0].length, text: m[0].trim(), kind });
      }
    }
    // Quita solapados: ordena por inicio y largo desc, conserva el más completo.
    hits.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));
    let lastEnd = -1;
    for (const h of hits) {
      if (h.start >= lastEnd) {
        out.push({ text: h.text, time, kind: h.kind });
        lastEnd = h.end;
      }
    }
  }
  return out;
}
