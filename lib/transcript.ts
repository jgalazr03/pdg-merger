// Modelo y formateadores compartidos de la transcripción (módulo Medios). Tanto
// el modo local (Whisper) como el servidor (Deepgram Nova-3) normalizan su
// salida a `Chunk[]`, así que toda la presentación y exportación vive aquí.

/** Segmento de transcripción con su ventana temporal en segundos. `end` puede
 *  ser null (Whisper a veces no lo entrega en el último fragmento). `speaker`
 *  solo está presente cuando hubo diarización (modo servidor). */
export type Chunk = {
  timestamp: [number, number | null];
  text: string;
  speaker?: number;
};

function pad(n: number, len = 2): string {
  return String(n).padStart(len, '0');
}

/** Reloj humano: `m:ss`, o `h:mm:ss` para audios de más de una hora. */
export function clock(t: number): string {
  const total = Math.max(0, Math.floor(t));
  const s = total % 60;
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600);
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** Marca de tiempo SRT: `HH:MM:SS,mmm`. */
function srtTime(t: number): string {
  const ms = Math.floor((t - Math.floor(t)) * 1000);
  const s = Math.floor(t) % 60;
  const m = Math.floor(t / 60) % 60;
  const h = Math.floor(t / 3600);
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}

/** Marca de tiempo WebVTT: `HH:MM:SS.mmm`. */
function vttTime(t: number): string {
  return srtTime(t).replace(',', '.');
}

/** Fin efectivo de un segmento (si falta, se apoya en el inicio del siguiente). */
export function endOf(chunks: Chunk[], i: number): number {
  const c = chunks[i];
  if (c.timestamp[1] != null) return c.timestamp[1];
  const next = chunks[i + 1]?.timestamp[0];
  return next != null ? next : (c.timestamp[0] ?? 0) + 2;
}

/** Índice del segmento que contiene el instante `t` (-1 si ninguno). */
export function activeIndexAt(chunks: Chunk[], t: number): number {
  for (let i = 0; i < chunks.length; i++) {
    const start = chunks[i].timestamp[0] ?? 0;
    if (t < start) return -1;
    if (t < endOf(chunks, i)) return i;
  }
  return -1;
}

/** Etiqueta legible de un hablante (0 → «Hablante 1»). */
export function speakerLabel(speaker: number): string {
  return `Hablante ${speaker + 1}`;
}

/** Texto corrido y limpio (un párrafo), o por hablante si hubo diarización. */
export function plainText(chunks: Chunk[]): string {
  const hasSpeakers = chunks.some((c) => c.speaker != null);
  if (!hasSpeakers) {
    return chunks
      .map((c) => c.text.trim())
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  // Agrupa fragmentos consecutivos del mismo hablante en un turno.
  const lines: string[] = [];
  let current = -1;
  let buffer = '';
  for (const c of chunks) {
    const sp = c.speaker ?? -1;
    if (sp !== current) {
      if (buffer) lines.push(buffer.trim());
      current = sp;
      buffer = `${speakerLabel(sp)}: ${c.text.trim()}`;
    } else {
      buffer += ` ${c.text.trim()}`;
    }
  }
  if (buffer) lines.push(buffer.trim());
  return lines.join('\n\n');
}

/** Transcripción para enviar a un LLM: cada línea con su inicio en SEGUNDOS
 *  entre corchetes (`[45] …`), para que pueda citar tiempos exactos. */
export function transcriptWithSeconds(chunks: Chunk[]): string {
  return chunks
    .map((c) => {
      const t = Math.round(c.timestamp[0] ?? 0);
      const who = c.speaker != null ? ` ${speakerLabel(c.speaker)}:` : '';
      return `[${t}]${who} ${c.text.trim()}`;
    })
    .join('\n');
}

/** Texto con marcas de tiempo por línea: `[m:ss] …`. */
export function timedText(chunks: Chunk[]): string {
  return chunks
    .map((c) => {
      const stamp = `[${clock(c.timestamp[0] ?? 0)}]`;
      const who = c.speaker != null ? ` ${speakerLabel(c.speaker)}:` : '';
      return `${stamp}${who} ${c.text.trim()}`;
    })
    .join('\n');
}

/** Subtítulos SubRip (.srt). */
export function toSrt(chunks: Chunk[]): string {
  return chunks
    .map((c, i) => {
      const start = c.timestamp[0] ?? 0;
      const end = endOf(chunks, i);
      return `${i + 1}\n${srtTime(start)} --> ${srtTime(end)}\n${c.text.trim()}`;
    })
    .join('\n\n');
}

/** Subtítulos WebVTT (.vtt). */
export function toVtt(chunks: Chunk[]): string {
  const body = chunks
    .map((c, i) => {
      const start = c.timestamp[0] ?? 0;
      const end = endOf(chunks, i);
      return `${vttTime(start)} --> ${vttTime(end)}\n${c.text.trim()}`;
    })
    .join('\n\n');
  return `WEBVTT\n\n${body}`;
}
