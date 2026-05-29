import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ToolAccent } from '@/lib/tools';

const STEPS = ['Subir', 'Opciones', 'Listo'] as const;

/**
 * Indicador de pasos VERTICAL (Subir → Opciones → Listo). El paso ACTUAL toma
 * el color de la herramienta (accent.line); los COMPLETADOS van en navy con
 * check; los pendientes en contorno apagado. El conector vertical se rellena
 * en navy conforme se avanza. Si no se pasa `accent`, el actual cae a navy.
 */
export default function StepIndicator({
  current,
  accent,
  className,
}: {
  current: 1 | 2 | 3;
  accent?: ToolAccent;
  className?: string;
}) {
  return (
    <ol className={cn('flex flex-col', className)}>
      {STEPS.map((label, i) => {
        const stepNumber = i + 1;
        const isDone = stepNumber < current;
        const isCurrent = stepNumber === current;
        const isLast = i === STEPS.length - 1;
        return (
          <li
            key={label}
            className="flex items-start gap-3"
            aria-current={isCurrent ? 'step' : undefined}
          >
            {/* Columna del indicador: círculo + conector vertical */}
            <div className="flex flex-col items-center">
              <span
                aria-hidden="true"
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-3 border-ink text-xs font-bold transition-colors',
                  isDone && 'bg-ink text-white',
                  isCurrent && cn(accent ? accent.line : 'bg-ink', 'text-white'),
                  !isDone && !isCurrent && 'bg-surface text-muted-foreground'
                )}
              >
                {isDone ? <Check className="h-4 w-4" /> : stepNumber}
              </span>
              {!isLast && (
                <span
                  aria-hidden="true"
                  className={cn(
                    'my-1 h-6 w-[3px] transition-colors duration-200 ease-out',
                    isDone ? 'bg-ink' : 'bg-ink/25'
                  )}
                />
              )}
            </div>

            {/* Etiqueta, alineada al centro del círculo */}
            <div className="flex h-8 items-center">
              <span
                className={cn(
                  'text-sm font-bold',
                  isCurrent ? 'text-ink' : 'text-muted-foreground'
                )}
              >
                <span className="sr-only">
                  Paso {stepNumber}
                  {isCurrent ? ' (actual)' : ''}:{' '}
                </span>
                {label}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
