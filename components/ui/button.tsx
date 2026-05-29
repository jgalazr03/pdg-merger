import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  // Firma del sistema: borde navy grueso (3px), radius 5px, color plano, sin
  // sombras. Foco por teclado en ink (ring-ring = navy).
  'inline-flex items-center justify-center whitespace-nowrap rounded-lg border-3 border-ink text-sm font-bold ring-offset-background transition-[transform,opacity,background-color,border-color,color] duration-150 ease-out active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        // Primario por defecto = navy (--primary). En los flujos de herramienta
        // el CTA se tiñe con el color de la herramienta vía `accent.solid`.
        default: 'bg-primary text-primary-foreground hover:opacity-85',
        // Destructivo = rojo de señal (eliminar, limpiar permanente, errores).
        destructive: 'bg-destructive text-destructive-foreground hover:opacity-85',
        // Secundario: papel con borde navy.
        outline: 'bg-surface text-ink hover:bg-muted',
        secondary: 'bg-card text-ink hover:bg-muted',
        // Ghost: sin borde, relleno suave al hover.
        ghost: 'border-transparent text-ink hover:bg-muted',
        link: 'border-transparent text-brand-ocean underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 px-3',
        lg: 'h-11 px-6 text-base',
        icon: 'h-11 w-11',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
