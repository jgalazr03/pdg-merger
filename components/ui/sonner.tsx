'use client';

import { Toaster as Sonner } from 'sonner';

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * Toaster alineado al sistema de diseño. La app es light-only, así que el tema
 * se fija en "light" (no se sigue el modo del SO). En vez de `richColors` (que
 * usa la paleta propia de sonner), los tipos se mapean a los tokens de marca:
 * éxito → success, error → rojo de marca, aviso → warning.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:rounded-xl group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
          title: 'group-[.toast]:font-semibold',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton:
            'group-[.toast]:rounded-md group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton:
            'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
          success:
            'group-[.toaster]:text-success group-[.toaster]:border-success/30',
          error:
            'group-[.toaster]:text-brand-red group-[.toaster]:border-brand-red/40',
          warning:
            'group-[.toaster]:text-warning-foreground group-[.toaster]:border-warning/40',
          info:
            'group-[.toaster]:text-brand-ocean group-[.toaster]:border-brand-ocean/30',
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
