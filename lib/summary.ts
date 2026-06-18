// Minuta/resumen automático de una transcripción (módulo Medios). El servidor
// (Claude) emite esta estructura vía tool use (JSON garantizado) y el cliente
// la pinta con componentes propios. Tipo compartido cliente/servidor.

export type Tarea = { descripcion: string; responsable?: string | null };

export type Minuta = {
  /** Título corto que describe el contenido del audio. */
  titulo: string;
  /** Síntesis en 2-4 frases. */
  resumen: string;
  /** Ideas principales (siempre presente). */
  puntosClave: string[];
  /** Decisiones tomadas (vacío si no aplica, p. ej. una clase o nota de voz). */
  acuerdos: string[];
  /** Pendientes/acciones, con responsable si se mencionó (vacío si no aplica). */
  tareas: Tarea[];
};

/** Serializa la minuta a Markdown para copiar o descargar (omite secciones
 *  vacías). */
export function minutaToText(m: Minuta): string {
  const parts: string[] = [`# ${m.titulo}`.trim(), '', m.resumen.trim()];

  if (m.puntosClave.length) {
    parts.push('', '## Puntos clave', ...m.puntosClave.map((p) => `- ${p.trim()}`));
  }
  if (m.acuerdos.length) {
    parts.push('', '## Acuerdos', ...m.acuerdos.map((a) => `- ${a.trim()}`));
  }
  if (m.tareas.length) {
    parts.push(
      '',
      '## Tareas',
      ...m.tareas.map((t) => {
        const who = t.responsable ? ` — ${t.responsable.trim()}` : '';
        return `- ${t.descripcion.trim()}${who}`;
      })
    );
  }
  return parts.join('\n');
}
