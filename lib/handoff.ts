'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { getTool, ToolDef, ToolSlug } from '@/lib/tools';

/**
 * Traspaso "Continuar con…": pasa el resultado recién generado en una
 * herramienta a la siguiente sin que el usuario tenga que descargarlo y
 * volver a subirlo (patrón "Continue to…" de iLovePDF).
 *
 * Vive en una variable de módulo, EN MEMORIA: la navegación del app router
 * conserva el runtime de JS (no recarga la página), así que sobrevive al
 * `router.push`. Si la pestaña se recarga, se pierde y la herramienta destino
 * simplemente muestra su dropzone normal (aceptado).
 */
export interface Handoff {
  file: File;
  from: ToolSlug;
  at: number;
}

/** Caducidad del traspaso: pasado este tiempo se descarta como obsoleto. */
const HANDOFF_TTL_MS = 10 * 60 * 1000;

let pending: Handoff | null = null;

/** Guarda un traspaso de un solo uso, listo para que la siguiente herramienta lo recoja. */
export function offerHandoff(file: File, from: ToolSlug): void {
  pending = { file, from, at: Date.now() };
}

/**
 * Devuelve el traspaso pendiente y lo limpia de inmediato (un solo uso, y
 * seguro ante el doble montaje de StrictMode). `null` si no hay ninguno o si
 * ya caducó.
 */
export function takeHandoff(): Handoff | null {
  const handoff = pending;
  pending = null;
  if (!handoff) return null;
  if (Date.now() - handoff.at > HANDOFF_TTL_MS) return null;
  return handoff;
}

/**
 * Construye un FileList de un solo archivo: varios manejadores de selección
 * de las herramientas receptoras esperan ese tipo (el mismo que entrega
 * FileDropzone), y FileList no tiene constructor público.
 */
export function fileListFrom(files: File[]): FileList {
  const dt = new DataTransfer();
  files.forEach((file) => dt.items.add(file));
  return dt.files;
}

/**
 * Al montar, recoge un traspaso pendiente de otra herramienta (si lo hay) y
 * lo entrega a `onFile`, avisando con un toast de dónde vino.
 *
 * El callback se guarda en un ref para no depender de su identidad: así el
 * efecto corre una sola vez al montar (no en cada render por un callback
 * recreado) y `takeHandoff` no se llama dos veces.
 */
export function useHandoff(onFile: (file: File, from: ToolDef) => void): void {
  const onFileRef = useRef(onFile);
  onFileRef.current = onFile;

  useEffect(() => {
    const handoff = takeHandoff();
    if (!handoff) return;
    const fromTool = getTool(handoff.from);
    onFileRef.current(handoff.file, fromTool);
    toast.success(`Recibido desde ${fromTool.name}`, {
      description: handoff.file.name,
    });
  }, []);
}
