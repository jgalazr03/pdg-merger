'use client';

import { Toaster as Sonner } from 'sonner';
import { CircleCheck, CircleX, TriangleAlert, Info, Loader2 } from 'lucide-react';

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * Toaster alineado al sistema de diseño. La app es light-only, así que el tema
 * se fija en "light". Dos ajustes clave al sistema:
 *  1) Tipografía mono del sistema (Roboto Mono) forzada con `!` (sonner trae su
 *     propia familia).
 *  2) Íconos lucide on-brand en lugar de los SVG propios de sonner; heredan el
 *     color del tipo vía `currentColor`.
 * Cada tipo mapea a un token de marca: éxito → success, error → rojo de marca,
 * aviso → warning, info → océano.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      icons={{
        success: <CircleCheck className="h-5 w-5" aria-hidden="true" />,
        error: <CircleX className="h-5 w-5" aria-hidden="true" />,
        warning: <TriangleAlert className="h-5 w-5" aria-hidden="true" />,
        info: <Info className="h-5 w-5" aria-hidden="true" />,
        loading: <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />,
      }}
      toastOptions={{
        classNames: {
          // Panel del sistema: tipografía mono, borde navy 3px, radius 5px,
          // color plano (papel), sin sombra. `!` para ganar al CSS interno de
          // sonner (familia, borde, fondo).
          toast:
            'group toast group-[.toaster]:!font-mono group-[.toaster]:rounded-lg group-[.toaster]:!bg-popover group-[.toaster]:text-foreground group-[.toaster]:!border-3 group-[.toaster]:!border-ink group-[.toaster]:shadow-none',
          title: 'group-[.toast]:!font-mono group-[.toast]:font-bold',
          description:
            'group-[.toast]:!font-mono group-[.toast]:text-muted-foreground',
          // Sonner fija el slot del icono en 16px; nuestro icono lucide es de
          // 25px, así que ajustamos el slot a ese tamaño y damos separación
          // real con el texto (sonner solo deja 4px). `!` para ganar a su CSS.
          icon: 'group-[.toast]:!mr-3 group-[.toast]:!h-5 group-[.toast]:!w-5 group-[.toast]:shrink-0',
          // Acción = navy relleno (no rojo: el rojo queda para CTA/destructivo).
          actionButton:
            'group-[.toast]:!rounded group-[.toast]:!border-2 group-[.toast]:!border-ink group-[.toast]:!bg-ink group-[.toast]:!text-white group-[.toast]:!font-mono group-[.toast]:!font-bold',
          // Cancelar = secundario (papel + borde navy).
          cancelButton:
            'group-[.toast]:!rounded group-[.toast]:!border-2 group-[.toast]:!border-ink group-[.toast]:!bg-surface group-[.toast]:!text-ink group-[.toast]:!font-mono group-[.toast]:!font-bold',
          // Estado por icono + color del título (ambos heredan currentColor); el
          // cromo (borde/fondo) NO se tiñe. `!` para ganarle al text-foreground base.
          success: 'group-[.toaster]:!text-success',
          error: 'group-[.toaster]:!text-brand-red',
          warning: 'group-[.toaster]:!text-warning-foreground',
          info: 'group-[.toaster]:!text-brand-ocean',
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
