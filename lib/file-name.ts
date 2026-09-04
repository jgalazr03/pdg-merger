/**
 * Validación del nombre de archivo final, compartida por las herramientas que
 * permiten renombrarlo (hoy: Unir, Girar, Organizar). Misma lógica y mismos
 * mensajes que `validateFileName` en `PDFMerger.tsx` (fuente original).
 */

const INVALID_CHARS = /[\/\\:*?"<>|]/;

const RESERVED_NAMES = [
  'CON',
  'PRN',
  'AUX',
  'NUL',
  'COM1',
  'COM2',
  'COM3',
  'COM4',
  'COM5',
  'COM6',
  'COM7',
  'COM8',
  'COM9',
  'LPT1',
  'LPT2',
  'LPT3',
  'LPT4',
  'LPT5',
  'LPT6',
  'LPT7',
  'LPT8',
  'LPT9',
];

/**
 * Valida el nombre elegido por la persona usuaria. `null` = válido (un
 * nombre vacío es válido: la herramienta usará su nombre por defecto).
 */
export function fileNameError(name: string): string | null {
  if (!name.trim()) return null;

  if (INVALID_CHARS.test(name)) {
    return 'El nombre no puede contener los caracteres: / \\ : * ? " < > |';
  }

  if (RESERVED_NAMES.includes(name.toUpperCase())) {
    return 'Este nombre está reservado por el sistema';
  }

  if (name.length > 200) {
    return 'El nombre es demasiado largo (máximo 200 caracteres)';
  }

  return null;
}

/** Nombre final a usar: el texto recortado, o `fallback` si quedó vacío. */
export function resolveFileName(name: string, fallback: string): string {
  const trimmed = name.trim();
  return trimmed || fallback;
}
