'use client';

import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';

export type BatchStatus = 'pending' | 'processing' | 'done' | 'error';

export interface BatchItem {
  id: string;
  file: File;
  status: BatchStatus;
  progress?: number;
  blob?: Blob;
  outName?: string;
  error?: string;
}

export interface BatchOptions {
  /** Validación: devuelve true si el archivo se acepta. */
  accept: (file: File) => boolean;
  /** Procesa un archivo y devuelve el blob resultante. */
  process: (file: File, onProgress: (pct: number) => void) => Promise<Blob>;
  /** Nombre del archivo de salida para un archivo dado. */
  outName: (file: File) => string;
  /** Nombre del .zip cuando hay varios resultados. */
  zipName?: string;
  /** Mensaje al rechazar archivos no válidos. */
  rejectMessage?: string;
}

let counter = 0;
const nextId = () => `f${Date.now().toString(36)}-${counter++}`;

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Hook reutilizable para herramientas por lotes: gestiona la lista de archivos,
 * validación, procesamiento secuencial con estado por archivo, y descarga
 * (individual o en .zip si hay varios resultados). El procesamiento concreto lo
 * aporta cada herramienta vía `opts.process`.
 */
export function useBatchProcessor(opts: BatchOptions) {
  const [items, setItems] = useState<BatchItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [done, setDone] = useState(false);

  // Refs para que los callbacks sean estables sin cerrar sobre estado viejo.
  const itemsRef = useRef<BatchItem[]>([]);
  itemsRef.current = items;
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const patch = useCallback((id: string, changes: Partial<BatchItem>) => {
    setItems((prev) => prev.map((p) => (p.id === id ? { ...p, ...changes } : p)));
  }, []);

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const o = optsRef.current;
    setDone(false);
    setItems((prev) => {
      const next = [...prev];
      let rejected = 0;
      Array.from(incoming).forEach((f) => {
        if (!o.accept(f)) {
          rejected++;
          return;
        }
        if (next.some((it) => it.file.name === f.name && it.file.size === f.size)) {
          return;
        }
        next.push({ id: nextId(), file: f, status: 'pending' });
      });
      if (rejected) {
        toast.error(o.rejectMessage ?? 'Algunos archivos no son compatibles');
      }
      return next;
    });
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
    setDone(false);
  }, []);

  const reset = useCallback(() => {
    setItems([]);
    setDone(false);
  }, []);

  const run = useCallback(async () => {
    const pending = itemsRef.current.filter((it) => it.status !== 'done');
    if (pending.length === 0) return;
    const o = optsRef.current;
    setIsProcessing(true);
    // Secuencial: procesar en paralelo puede agotar memoria con PDFs grandes.
    for (const it of pending) {
      patch(it.id, { status: 'processing', progress: 0, error: undefined });
      try {
        const blob = await o.process(it.file, (pct) =>
          patch(it.id, { progress: pct })
        );
        patch(it.id, {
          status: 'done',
          progress: 100,
          blob,
          outName: o.outName(it.file),
        });
      } catch (err) {
        console.error('Error procesando', it.file.name, err);
        patch(it.id, {
          status: 'error',
          error: String((err as Error)?.message ?? 'Error'),
        });
      }
    }
    setIsProcessing(false);
    setDone(true);
  }, [patch]);

  const downloadAll = useCallback(async () => {
    const o = optsRef.current;
    const ready = itemsRef.current.filter((it) => it.status === 'done' && it.blob);
    if (ready.length === 0) return;
    if (ready.length === 1) {
      downloadBlob(ready[0].blob!, ready[0].outName ?? ready[0].file.name);
      return;
    }
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    ready.forEach((it) => zip.file(it.outName ?? it.file.name, it.blob!));
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    downloadBlob(zipBlob, o.zipName ?? 'archivos.zip');
  }, []);

  const downloadOne = useCallback((id: string) => {
    const it = itemsRef.current.find((x) => x.id === id);
    if (it?.blob) downloadBlob(it.blob, it.outName ?? it.file.name);
  }, []);

  const doneCount = items.filter((it) => it.status === 'done').length;
  const errorCount = items.filter((it) => it.status === 'error').length;

  return {
    items,
    isProcessing,
    done,
    doneCount,
    errorCount,
    addFiles,
    removeItem,
    reset,
    run,
    downloadAll,
    downloadOne,
  };
}
