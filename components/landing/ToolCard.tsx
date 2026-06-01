import Link from 'next/link';
import { ToolDef } from '@/lib/tools';
import { cn } from '@/lib/utils';

export default function ToolCard({
  tool,
  delayMs,
}: {
  tool: ToolDef;
  /**
   * Retardo de entrada en la cascada de la landing (ms). Solo se pasa en el
   * montaje inicial de la vista completa; al filtrar/buscar va `undefined` para
   * que los resultados aparezcan al instante (sin re-animar en cada tecla).
   */
  delayMs?: number;
}) {
  const animateIn = delayMs != null;
  return (
    <Link
      href={tool.href}
      style={animateIn ? { animationDelay: `${delayMs}ms` } : undefined}
      className={cn(
        // Panel del sistema: arena + borde navy 4px, color plano, sin sombra.
        // La tarjeta entera es el enlace. Hover TÁCTIL (sin sombra, on-system):
        // el panel se eleva 3px, el fondo se desplaza y el título se subraya;
        // al presionar, cede con un scale. La elevación es motion-safe.
        'group flex flex-col rounded-lg border-4 border-ink bg-card p-5 text-left transition-[transform,background-color] duration-150 ease-out active:scale-[0.99] sm:p-6',
        'hover-fine:bg-muted motion-safe:hover-fine:-translate-y-[3px]',
        // Entrada en cascada SOLO por opacidad (y solo en el montaje inicial): un
        // `slide-up` con fill `both` fijaría el `transform` y mataría el
        // hover-lift; el fade deja el `transform` libre para la elevación.
        animateIn && 'motion-safe:animate-fade-in',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2'
      )}
    >
      {/* Tile de ícono navy con borde navy, glifo blanco (sin sombra). Acompaña
          el hover con un salto sutil para reforzar el feedback táctil. */}
      <div
        className={cn(
          'flex h-12 w-12 items-center justify-center rounded-lg border-3 border-ink transition-transform duration-150 ease-out motion-safe:group-hover-fine:scale-105',
          tool.accent.iconBg
        )}
      >
        <tool.Icon className="h-6 w-6 text-white" strokeWidth={2} />
      </div>

      <h2 className="mt-5 text-lg font-bold text-ink decoration-2 underline-offset-4 group-hover-fine:underline">
        {tool.title}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {tool.tagline}
      </p>
    </Link>
  );
}
