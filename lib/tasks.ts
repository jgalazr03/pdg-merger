// Exporta acciones (compromisos del análisis / tareas de la minuta) a formatos
// accionables: una checklist Markdown para pegar en un gestor (Notion, Todoist,
// correo) y un CSV para hoja de cálculo. Es el paso "reunión → trabajo
// terminado" reutilizando lo que la IA ya extrajo (descripción, responsable,
// plazo), sin gastar IA adicional.

export type ActionItem = {
  descripcion: string;
  responsable?: string | null;
  plazo?: string | null;
};

/** Checklist Markdown: `- [ ] descripción — responsable (plazo)`. */
export function actionItemsToChecklist(items: ActionItem[]): string {
  return items
    .map((it) => {
      const who = it.responsable ? ` — ${it.responsable.trim()}` : '';
      const when = it.plazo ? ` (${it.plazo.trim()})` : '';
      return `- [ ] ${it.descripcion.trim()}${who}${when}`;
    })
    .join('\n');
}

function csvCell(v: string): string {
  const s = (v ?? '').trim();
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV con encabezado (separador coma, CRLF) listo para Excel/Sheets. */
export function actionItemsToCsv(items: ActionItem[]): string {
  const header = ['Pendiente', 'Responsable', 'Plazo'].join(',');
  const rows = items.map((it) =>
    [csvCell(it.descripcion), csvCell(it.responsable ?? ''), csvCell(it.plazo ?? '')].join(',')
  );
  return [header, ...rows].join('\r\n');
}

/** Descarga un CSV con BOM UTF-8 (para que Excel muestre bien los acentos). */
export function downloadCsv(content: string, filename: string) {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
