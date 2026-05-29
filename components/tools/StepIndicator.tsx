import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const STEPS = ['Subir', 'Opciones', 'Listo'] as const;

/**
 * Indicador de pasos (Subir → Opciones → Listo) con colores de marca:
 * rojo para el paso actual, navy para los completados. `current` es 1, 2 o 3.
 */
export default function StepIndicator({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol className="mb-10 flex items-center gap-3 border-y border-border/70 py-3">
      {STEPS.map((label, i) => {
        const stepNumber = i + 1;
        const isDone = stepNumber < current;
        const isCurrent = stepNumber === current;
        return (
          <li key={label} className="flex flex-1 items-center gap-3">
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors',
                  isDone && 'bg-brand-navy text-white',
                  isCurrent && 'bg-brand-red text-white ring-4 ring-brand-red/15',
                  !isDone && !isCurrent && 'bg-muted text-muted-foreground'
                )}
              >
                {isDone ? <Check className="h-3.5 w-3.5" /> : stepNumber}
              </span>
              <span
                className={cn(
                  'text-sm font-semibold',
                  isCurrent ? 'text-brand-navy' : 'text-muted-foreground'
                )}
              >
                <span className="sr-only">
                  Paso {stepNumber}
                  {isCurrent ? ' (actual)' : ''}:{' '}
                </span>
                {label}
              </span>
            </div>
            {stepNumber < STEPS.length && (
              <span
                aria-hidden="true"
                className={cn(
                  'h-px flex-1',
                  stepNumber < current ? 'bg-brand-navy/40' : 'bg-border'
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
