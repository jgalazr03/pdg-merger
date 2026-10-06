// Huella del contenido con el que se generó un resultado de IA. Si el usuario
// corrige el texto o renombra hablantes después, la huella cambia y el resultado
// se marca como desactualizado (se sigue mostrando, con opción de regenerar).
// No es criptográfica: solo detecta cambios, por eso basta un hash síncrono.
import type { Chunk, SpeakerNames } from '@/lib/transcript';
import type { AiKind } from './schema';

/** cyrb53: hash de 53 bits, rápido y con buena dispersión para strings. */
function cyrb53(str: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** Nombres en orden estable (el orden de inserción de un objeto no lo es para
 *  efectos de comparación entre sesiones). Los vacíos no cuentan. */
function stableNames(names: SpeakerNames): string {
  return Object.keys(names)
    .filter((k) => names[Number(k)]?.trim())
    .sort()
    .map((k) => `${k}=${names[Number(k)].trim()}`)
    .join('|');
}

/**
 * Huella de lo que cada tipo de resultado realmente consume. La traducción solo
 * depende del texto de los segmentos (no de los nombres de hablante), así que
 * renombrar no la invalida; el resto usa texto + nombres.
 */
export function sourceHashFor(
  kind: AiKind,
  chunks: Chunk[],
  names: SpeakerNames,
  fallbackText = ''
): string {
  const texts = chunks.length
    ? chunks.map((c) => c.text).join('\u0001')
    : fallbackText;
  if (kind === 'translation') return cyrb53(texts);
  return cyrb53(`${texts}\u0002${stableNames(names)}`);
}
