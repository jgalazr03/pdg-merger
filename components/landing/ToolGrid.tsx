import { toolsByCategory } from '@/lib/tools';
import ToolCard from './ToolCard';

/**
 * Catálogo de herramientas agrupado por categoría. Con el catálogo ampliado una
 * sola rejilla plana se vuelve ilegible; las secciones con encabezado dan
 * escaneo rápido y mantienen cada tarjeta con su color propio.
 */
export default function ToolGrid() {
  const groups = toolsByCategory();

  return (
    <div className="space-y-12 sm:space-y-14">
      {groups.map((group) => (
        <section key={group.category} aria-labelledby={`cat-${group.category}`}>
          <div className="mb-6">
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
              <ToolCard key={tool.slug} tool={tool} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
