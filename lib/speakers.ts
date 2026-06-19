// Identidad visual de los hablantes (módulo Medios). Un color estable por
// hablante que se usa igual en el reproductor, en el editor de nombres y en el
// reparto de participación, para que «quién es quién» se reconozca de un vistazo.
// Clases LITERALES de Tailwind (el JIT escanea este archivo); se ciclan si hay
// más hablantes que colores.

export const SPEAKER_DOT = [
  'bg-violet-700',
  'bg-amber-700',
  'bg-teal-700',
  'bg-fuchsia-700',
  'bg-sky-700',
  'bg-rose-700',
] as const;

/** Color (clase Tailwind) del hablante `speaker`, estable y cíclico. */
export function speakerColor(speaker: number): string {
  return SPEAKER_DOT[speaker % SPEAKER_DOT.length];
}
