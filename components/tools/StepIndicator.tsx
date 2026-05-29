import { Check } from 'lucide-react';
import { ToolAccent } from '@/lib/tools';
import { cn } from '@/lib/utils';

const STEPS = ['Subir', 'Opciones', 'Listo'] as const;

/**
 * Indicador de pasos del flujo de cada herramienta (Subir → Opciones → Listo).
 * `current` es 1, 2 o 3.
 */
export default function StepIndicator({
  current,
  accent,
}: {
  current: 1 | 2 | 3;
  accent: ToolAccent;
}) {
  return (
    <ol className="mx-auto mb-10 flex max-w-md items-center justify-center gap-2">
      {STEPS.map((label, i) => {
        const stepNumber = i + 1;
        const isDone = stepNumber < current;
        const isCurrent = stepNumber === current;
        return (
          <li key={label} className="flex flex-1 items-center gap-2">
            <div className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors',
                  isDone && cn(accent.soft, accent.text),
                  isCurrent && cn(accent.solid),
                  !isDone && !isCurrent && 'bg-gray-100 text-gray-400'
                )}
              >
                {isDone ? <Check className="h-4 w-4" /> : stepNumber}
              </span>
              <span
                className={cn(
                  'text-sm font-medium',
                  isCurrent ? 'text-gray-900' : 'text-gray-500'
                )}
              >
                <span className="sr-only">
                  Paso {stepNumber}{isCurrent ? ' (actual)' : ''}:{' '}
                </span>
                {label}
              </span>
            </div>
            {stepNumber < STEPS.length && (
              <span
                aria-hidden="true"
                className={cn(
                  'h-px flex-1',
                  stepNumber < current ? accent.iconBg : 'bg-gray-200'
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
