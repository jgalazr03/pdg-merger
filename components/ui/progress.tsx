'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Barra de progreso propia (sin Radix). Misma API y mismo estilo que antes,
 * pero evitamos `@radix-ui/react-progress`: el minificador SWC de Next 13.5.1
 * des-escapa los backticks de su `console.error` de desarrollo y genera JS
 * inválido que rompe el chunk en runtime ("missing ) after argument list").
 */
interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number | null;
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value, ...props }, ref) => {
    const pct = Math.min(100, Math.max(0, value ?? 0));
    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className={cn(
          // Relleno de acento (highlight teal) en track con borde navy, sin sombra.
          'relative h-4 w-full overflow-hidden rounded-lg border-3 border-ink bg-surface',
          className
        )}
        {...props}
      >
        <div
          className="h-full w-full flex-1 bg-highlight transition-all"
          style={{ transform: `translateX(-${100 - pct}%)` }}
        />
      </div>
    );
  }
);
Progress.displayName = 'Progress';

export { Progress };
