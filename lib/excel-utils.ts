// Utilidades client-only para manipular archivos .xlsx con ExcelJS (ya
// instalado, ~900 KB; se carga perezosamente dentro de cada función). ExcelJS
// NO clona worksheets de forma nativa: se copia celda a celda, con los estilos
// clonados en profundidad (son referencias) y las celdas combinadas recreadas.
// Solo soporta .xlsx (el .xls binario antiguo no lo lee ExcelJS).

import type { Workbook, Worksheet } from 'exceljs';

export const EXCEL_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const EXCEL_ACCEPT = '.xlsx';

export function isXlsx(file: File): boolean {
  return /\.xlsx$/i.test(file.name);
}

async function loadExcelJS() {
  return import('exceljs');
}

export async function newWorkbook(): Promise<Workbook> {
  const ExcelJS = await loadExcelJS();
  return new ExcelJS.Workbook();
}

export async function loadWorkbook(file: File): Promise<Workbook> {
  const ExcelJS = await loadExcelJS();
  const wb = new ExcelJS.Workbook();
  // En el navegador ExcelJS acepta ArrayBuffer aunque el tipo declare Buffer.
  await wb.xlsx.load((await file.arrayBuffer()) as never);
  return wb;
}

export async function workbookToBlob(wb: Workbook): Promise<Blob> {
  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer as BlobPart], { type: EXCEL_MIME });
}

/** Nombre de hoja válido para Excel: sin caracteres prohibidos, máx. 31 chars. */
function sanitizeSheetName(name: string): string {
  const cleaned = (name || 'Hoja').replace(/[\\/?*[\]:]/g, ' ').trim();
  return (cleaned || 'Hoja').slice(0, 31);
}

/** Nombre de hoja único dentro del libro destino (evita colisiones al unir). */
export function uniqueSheetName(wb: Workbook, desired: string): string {
  const base = sanitizeSheetName(desired);
  if (!wb.getWorksheet(base)) return base;
  let i = 2;
  for (;;) {
    const suffix = ` (${i})`;
    const candidate = base.slice(0, 31 - suffix.length) + suffix;
    if (!wb.getWorksheet(candidate)) return candidate;
    i++;
  }
}

/** Nombre de archivo seguro a partir del nombre de una hoja. */
export function sheetFileName(name: string): string {
  return (name || 'hoja').replace(/[\\/?*[\]:<>|"]/g, '_').trim() || 'hoja';
}

/**
 * Copia una hoja a otro libro: valores, estilos (clonados), anchos de columna,
 * altos de fila y celdas combinadas. Las fórmulas con referencias a otras hojas
 * del libro original pueden quedar sin destino (límite de la copia manual).
 */
export function copySheet(
  source: Worksheet,
  target: Workbook,
  name: string
): Worksheet {
  const sheet = target.addWorksheet(name);

  source.columns?.forEach((col, i) => {
    if (col?.width) sheet.getColumn(i + 1).width = col.width;
  });

  source.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const newRow = sheet.getRow(rowNumber);
    if (row.height) newRow.height = row.height;
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const newCell = newRow.getCell(colNumber);
      newCell.value = cell.value;
      if (cell.style) {
        // Los estilos de ExcelJS son referencias: clonar en profundidad.
        newCell.style = JSON.parse(JSON.stringify(cell.style));
      }
    });
  });

  // Las celdas combinadas no se copian con los valores; se recrean a mano.
  const merges = (source as unknown as { model?: { merges?: string[] } }).model
    ?.merges;
  merges?.forEach((range) => {
    try {
      sheet.mergeCells(range);
    } catch {
      // Rango inválido o solapado: se omite sin romper la copia.
    }
  });

  return sheet;
}
