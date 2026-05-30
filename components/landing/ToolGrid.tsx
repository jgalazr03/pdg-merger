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
            <h2
              id={`cat-${group.category}`}
              className="text-sm font-bold uppercase tracking-[0.2em] text-ink"
            >
              {group.label}
            </h2>
            {/* Regla con peso: acento navy grueso (3px) + hairline. */}
            <span
              aria-hidden="true"
              className="mt-2.5 flex h-[3px] items-end"
            >
              <span className="h-[3px] w-10 bg-ink" />
              <span className="h-px flex-1 bg-ink/20" />
            </span>
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
