import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ToolAccent } from '@/lib/tools';

const STEPS = ['Subir', 'Opciones', 'Listo'] as const;

/**
 * Indicador de pasos (Subir → Opciones → Listo) RESPONSIVE:
 *  - Móvil: banda HORIZONTAL compacta (círculo arriba, etiqueta debajo) que no
 *    roba alto vertical antes de la tarea.
 *  - Escritorio (md+): riel VERTICAL sticky a la izquierda.
 *
 * El paso ACTUAL toma el color de la herramienta (accent.line); los COMPLETADOS
 * van en navy con check; los pendientes en contorno apagado. Los conectores se
 * rellenan en navy conforme se avanza. Si no se pasa `accent`, el actual cae a
 * navy. La forma + el texto (no solo el color) comunican el progreso.
 */
export default function StepIndicator({
  current,
  accent,
  className,
  inline = false,
}: {
  current: 1 | 2 | 3;
  accent?: ToolAccent;
  className?: string;
  /**
   * Variante COMPACTA en línea: una fila delgada de círculos + el nombre del
   * paso actual. Pensada para la barra de contexto cuando ya hay un recurso
   * cargado (no roba una columna como el riel completo).
   */
  inline?: boolean;
}) {
  if (inline) {
    return (
      <ol
        className={cn('flex items-center', className)}
        aria-label={`Paso ${current} de ${STEPS.length}: ${STEPS[current - 1]}`}
      >
        {STEPS.map((label, i) => {
          const stepNumber = i + 1;
          const isDone = stepNumber < current;
          const isCurrent = stepNumber === current;
          const prevDone = stepNumber - 1 < current; // conector antes de este paso
          return (
            <li key={label} className="flex items-center">
              {i > 0 && (
                <span
                  aria-hidden="true"
                  className={cn(
                    'h-[3px] w-4 transition-colors duration-200 ease-out',
                    prevDone ? 'bg-ink' : 'bg-ink/25'
                  )}
                />
              )}
              <span
                aria-hidden="true"
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-ink text-[11px] font-bold transition-colors',
                  isDone && 'bg-ink text-white',
                  isCurrent && cn(accent ? accent.line : 'bg-ink', 'text-white'),
                  !isDone && !isCurrent && 'bg-surface text-muted-foreground'
                )}
              >
                {isDone ? <Check className="h-3.5 w-3.5" /> : stepNumber}
              </span>
            </li>
          );
        })}
        <span className="ml-2.5 whitespace-nowrap text-sm font-bold text-ink">
          {STEPS[current - 1]}
        </span>
      </ol>
    );
  }

  return (
    <ol className={cn('flex flex-row items-start md:flex-col', className)}>
      {STEPS.map((label, i) => {
        const stepNumber = i + 1;
        const isDone = stepNumber < current; // este paso ya se completó
        const isCurrent = stepNumber === current;
        const isFirst = i === 0;
        const isLast = i === STEPS.length - 1;
        // El conector entre el paso n-1 y n se "llena" cuando n-1 está completo.
        // Las mitades adyacentes coinciden por construcción (mismo predicado).
        const prevDone = stepNumber - 1 < current;
        return (
          <li
            key={label}
            aria-current={isCurrent ? 'step' : undefined}
            className="flex flex-1 flex-col items-center text-center md:flex-none md:flex-row md:items-start md:gap-3 md:text-left"
          >
            {/* Círculo + conectores: fila (móvil) / columna (md+) */}
            <div className="flex w-full items-center md:w-auto md:flex-col">
              {/* Conector IZQUIERDO (solo móvil): siempre presente para centrar
                  el círculo en su celda; invisible en el primer paso. La mitad
                  se "llena" cuando el paso previo está completo. */}
              <span
                aria-hidden="true"
                className={cn(
                  'h-[3px] flex-1 transition-colors duration-200 ease-out md:hidden',
                  isFirst && 'invisible',
                  prevDone ? 'bg-ink' : 'bg-ink/25'
                )}
              />

              <span
                aria-hidden="true"
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-3 border-ink text-xs font-bold transition-colors md:h-8 md:w-8',
                  isDone && 'bg-ink text-white',
                  isCurrent && cn(accent ? accent.line : 'bg-ink', 'text-white'),
                  !isDone && !isCurrent && 'bg-surface text-muted-foreground'
                )}
              >
                {isDone ? <Check className="h-4 w-4" /> : stepNumber}
              </span>

              {/* Conector DERECHO (solo móvil): invisible en el último paso. */}
              <span
                aria-hidden="true"
                className={cn(
                  'h-[3px] flex-1 transition-colors duration-200 ease-out md:hidden',
                  isLast && 'invisible',
                  isDone ? 'bg-ink' : 'bg-ink/25'
                )}
              />

              {/* Conector VERTICAL (solo escritorio), no en el último */}
              {!isLast && (
                <span
                  aria-hidden="true"
                  className={cn(
                    'my-1 hidden h-6 w-[3px] transition-colors duration-200 ease-out md:block',
                    isDone ? 'bg-ink' : 'bg-ink/25'
                  )}
                />
              )}
            </div>

            {/* Etiqueta: debajo del círculo (móvil) / a su lado (md+) */}
            <div className="mt-1 md:mt-0 md:flex md:h-8 md:items-center">
              <span
                className={cn(
                  'text-xs font-bold sm:text-sm',
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
