import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { ToolDef } from '@/lib/tools';
import { cn } from '@/lib/utils';
import StepIndicator from './StepIndicator';

/**
 * Cáscara común de cada herramienta. Hero asimétrico (lockup alineado a la
 * izquierda) con tile navy de marca, breadcrumb e indicador de pasos, sobre
 * la atmósfera global. El contenido específico va como children.
 */
export default function ToolShell({
  tool,
  step,
  children,
  wide = false,
}: {
  tool: ToolDef;
  step: 1 | 2 | 3;
  children: React.ReactNode;
  /** Ensancha el contenedor (módulo Medios: el resultado usa 2 columnas y
   *  aprovecha el ancho de escritorio). El resto de herramientas usa el ancho
   *  estándar. */
  wide?: boolean;
}) {
  return (
    // Móvil: preludio comprimido (la tarea primero — el dropzone debe asomar
    // sin scroll al entrar); escritorio conserva el aire generoso.
    <div
      className={cn(
        'container mx-auto py-5 pl-[max(20px,env(safe-area-inset-left))] pr-[max(20px,env(safe-area-inset-right))] sm:py-8 md:py-16',
        wide ? 'max-w-6xl' : 'max-w-4xl'
      )}
    >
      <nav aria-label="Ruta de navegación" className="mb-4 sm:mb-8">
        <ol className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <li>
            <Link
              href="/"
              className="rounded font-bold transition-colors hover-fine:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
            >
              Inicio
            </Link>
          </li>
          <li aria-hidden="true">
            <ChevronRight className="h-3.5 w-3.5" />
          </li>
          <li
            aria-current="page"
            className="flex items-center gap-1.5 font-bold text-ink"
          >
            <tool.Icon
              className={cn('h-4 w-4 shrink-0', tool.accent.text)}
              strokeWidth={2}
              aria-hidden="true"
            />
            {tool.name}
          </li>
        </ol>
      </nav>

      {/* Hero asimétrico: tile a la izquierda, título a la derecha */}
      <header className="mb-5 flex items-start gap-4 motion-safe:animate-fade-in sm:mb-10 sm:gap-5">
        <div
          className={cn(
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border-3 border-ink sm:h-16 sm:w-16',
            tool.accent.iconBg
          )}
        >
          <tool.Icon className="h-6 w-6 text-white sm:h-8 sm:w-8" strokeWidth={2} />
        </div>

        <div className="min-w-0 pt-0.5 sm:pt-1">
          <h1 className="text-[clamp(1.6rem,6vw,2.25rem)] font-bold leading-[1.1] tracking-tight text-ink">
            {tool.title}
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground sm:text-base md:text-lg">
            {tool.tagline}{' '}
            <span className="text-ink/60">Todo se procesa en tu navegador.</span>
          </p>
        </div>
      </header>

      {/* Riel de pasos vertical a la izquierda (md+); apilado arriba en móvil */}
      <div className="md:grid md:grid-cols-[auto_1fr] md:gap-10">
        <StepIndicator
          current={step}
          accent={tool.accent}
          className="mb-5 md:mb-0 md:sticky md:top-24 md:self-start"
        />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
