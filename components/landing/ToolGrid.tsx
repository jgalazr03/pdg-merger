import { toolsByCategory } from '@/lib/tools';
import ToolCard from './ToolCard';

/**
 * Catálogo de herramientas agrupado por categoría. Con el catálogo ampliado una
 * sola rejilla plana se vuelve ilegible; las secciones con encabezado dan
 * escaneo rápido y mantienen cada tarjeta con su color propio.
 *
 * Entrada en CASCADA (Emil, ease-out-quint): cada encabezado y cada tarjeta
 * revela con un retardo incremental en orden de lectura, en vez de un solo
 * bloque. El paso es corto y se ACOTA (los elementos tras el tope entran juntos)
 * para no rezagar el final; `prefers-reduced-motion` lo neutraliza vía
 * `motion-safe:` + el catch-all global.
 */
const STAGGER_STEP = 40; // ms entre elementos consecutivos
const STAGGER_CAP = 12; // a partir de aquí, todo entra a la vez
const STAGGER_BASE = 50; // arranca justo tras el fade del hero
const revealDelay = (order: number) =>
  STAGGER_BASE + Math.min(order, STAGGER_CAP) * STAGGER_STEP;

export default function ToolGrid() {
  const groups = toolsByCategory();
  // Orden de revelado en lectura (cabecera, luego sus tarjetas, sección a
  // sección). Mutar el contador en el render es seguro: es síncrono y de un
  // solo paso en un Server Component.
  let order = 0;
  const next = () => order++;

  return (
    <div className="space-y-12 sm:space-y-14">
      {groups.map((group) => {
        const headerDelay = revealDelay(next());
        return (
          <section key={group.category} aria-labelledby={`cat-${group.category}`}>
            <div
              className="mb-6 motion-safe:animate-slide-up"
              style={{ animationDelay: `${headerDelay}ms` }}
            >
              {/* Pestaña con borde (como las tarjetas) apoyada sobre regla navy. */}
              <div className="flex">
                <h2
                  id={`cat-${group.category}`}
                  className="rounded-t-lg border-3 border-b-0 border-ink bg-surface px-4 py-2 text-sm font-bold uppercase leading-none tracking-[0.2em] text-ink"
                >
                  {group.label}
                </h2>
              </div>
              <div aria-hidden="true" className="h-[3px] w-full bg-ink" />
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {group.tools.map((tool) => (
                <ToolCard key={tool.slug} tool={tool} delayMs={revealDelay(next())} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
