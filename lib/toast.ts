import { toast } from 'sonner';

/**
 * Toast de acción destructiva con red de seguridad: muestra un mensaje y un
 * botón "Deshacer" que ejecuta `onUndo`. Centraliza el cableado y la etiqueta
 * para que las herramientas solo declaren qué restaurar.
 *
 * Vive aparte de `lib/utils` (que importa `cn` en toda la app) para no arrastrar
 * sonner a las páginas que solo necesitan utilidades de estilo.
 */
export function toastUndo(
  title: string,
  opts: { description?: string; onUndo: () => void }
) {
  toast(title, {
    description: opts.description,
    action: { label: 'Deshacer', onClick: opts.onUndo },
  });
}
