// Capítulos/temas automáticos de la grabación. Claude divide la transcripción
// en secciones con su tiempo de inicio; el cliente las pinta como una lista
// navegable (cada capítulo salta el reproductor a su momento).

import { clock } from './transcript';

export type Chapter = {
  /** Inicio del capítulo en segundos. */
  time: number;
  /** Título corto del tema. */
  title: string;
  /** Una frase que resume el capítulo. */
  summary: string;
};

/** Texto en formato de capítulos (estilo YouTube): `m:ss Título` por línea,
 *  listo para pegar en la descripción de un video. */
export function chaptersToText(chapters: Chapter[]): string {
  return chapters.map((c) => `${clock(c.time)} ${c.title}`).join('\n');
}
