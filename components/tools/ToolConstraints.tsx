import { ChevronDown, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Quita acentos y pasa a minúsculas para comparar sin distinguir mayúsculas/acentos. */
const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[áàäâ]/g, 'a')
    .replace(/[éèëê]/g, 'e')
    .replace(/[íìïî]/g, 'i')
    .replace(/[óòöô]/g, 'o')
    .replace(/[úùüû]/g, 'u')
    .replace(/ñ/g, 'n');

/**
 * Un ítem es "duro" (formato o tamaño máximo: lo que de verdad rechaza un
 * archivo) si empieza por "Formato", "Formatos", "Tamaño máximo" o "Máximo".
 * Devuelve su versión compacta para la línea siempre visible, o `null` si el
 * ítem no es duro (se queda dentro del `<details>`).
 */
function hardConstraintLabel(item: string): string | null {
  const trimmed = item.trim();
  const norm = normalize(trimmed);
  const isFormato = norm.startsWith('formato'); // cubre "formato" y "formatos"
  const isMaximo = norm.startsWith('tamano maximo') || norm.startsWith('maximo');
  if (!isFormato && !isMaximo) return null;

  const colonIndex = trimmed.indexOf(':');
  const rest = colonIndex !== -1 ? trimmed.slice(colonIndex + 1).trim() : trimmed;

  // "Formato(s): X" → "X"; "Tamaño máximo…: X" / "Máximo…: X" → "Hasta X".
  return isMaximo ? `Hasta ${rest}` : rest;
}

/**
 * Formatos y límites de una herramienta. Los ítems "duros" (formato, tamaño
 * máximo) se ven siempre en una línea compacta, porque son la razón número
 * uno de error al subir un archivo; el resto queda en divulgación progresiva
 * dentro de un `<details>` — una línea discreta (info + chevron) que se
 * despliega bajo demanda, en vez de un banner que ocupa toda una sección.
 * Tokens neutros (borde ink, texto muted) — NO color de advertencia, porque
 * son especificaciones, no alertas. `<details>` nativo: accesible y sin
 * JavaScript.
 */
export default function ToolConstraints({
  items,
  className,
}: {
  items: string[];
  className?: string;
}) {
  if (items.length === 0) return null;

  const hardItems: string[] = [];
  const softItems: string[] = [];
  items.forEach((item) => {
    const label = hardConstraintLabel(item);
    if (label !== null) {
      hardItems.push(label);
    } else {
      softItems.push(item);
    }
  });

  const hardLine = hardItems.length > 0 ? hardItems.join(' · ') : null;

  const hardLineNode = hardLine && (
    <p
      className={cn(
        'px-4 py-2.5 text-xs font-bold uppercase tabular-nums tracking-[0.08em] text-muted-foreground',
        softItems.length > 0 && 'border-b-3 border-ink'
      )}
    >
      {hardLine}
    </p>
  );

  return (
    <div className={cn('mb-8 rounded-lg border-3 border-ink bg-surface', className)}>
      {hardLineNode}
      {softItems.length > 0 && (
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-sm font-bold text-ink transition-colors hover-fine:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
            <Info className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            Formatos y límites
            <ChevronDown
              className="ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <ul className="space-y-1.5 border-t-3 border-ink px-4 py-3 text-sm text-muted-foreground">
            {softItems.map((item) => (
              <li key={item} className="flex gap-2">
                <span aria-hidden="true" className="select-none text-ink">
                  ·
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
