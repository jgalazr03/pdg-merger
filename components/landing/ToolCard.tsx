import Link from 'next/link';
import { ToolDef } from '@/lib/tools';
import { cn } from '@/lib/utils';

export default function ToolCard({ tool }: { tool: ToolDef }) {
  return (
    <Link
      href={tool.href}
      className={cn(
        // Panel del sistema: arena + borde navy 4px, color plano, sin sombra.
        // La tarjeta entera es el enlace; el hover desplaza el fondo y subraya
        // el título. Sin flechas ni acentos decorativos.
        'group flex flex-col rounded-lg border-4 border-ink bg-card p-5 text-left transition-[transform,background-color] duration-150 ease-out active:scale-[0.99] sm:p-6',
        'hover:bg-muted',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2'
      )}
    >
      {/* Tile de ícono navy con borde navy, glifo blanco (sin sombra). */}
      <div
        className={cn(
          'flex h-12 w-12 items-center justify-center rounded-lg border-3 border-ink',
          tool.accent.iconBg
        )}
      >
        <tool.Icon className="h-6 w-6 text-white" strokeWidth={2} />
      </div>

      <h2 className="mt-5 text-lg font-bold text-ink decoration-2 underline-offset-4 group-hover:underline">
        {tool.title}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {tool.tagline}
      </p>
    </Link>
  );
}
