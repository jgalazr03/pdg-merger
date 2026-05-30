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
          <h2
            id={`cat-${group.category}`}
            className="mb-6 border-b-2 border-ink/15 pb-2.5 text-sm font-bold uppercase tracking-[0.18em] text-ink"
          >
            <span
              aria-hidden="true"
              className="mr-2.5 inline-block h-2 w-2 bg-ink align-middle"
            />
            {group.label}
          </h2>
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
