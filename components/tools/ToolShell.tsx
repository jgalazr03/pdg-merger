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
}: {
  tool: ToolDef;
  step: 1 | 2 | 3;
  children: React.ReactNode;
}) {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-8 md:py-12">
      <nav aria-label="Ruta de navegación" className="mb-8">
        <ol className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <li>
            <Link
              href="/"
              className="rounded font-bold transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
            >
              Inicio
            </Link>
          </li>
          <li aria-hidden="true">
            <ChevronRight className="h-3.5 w-3.5" />
          </li>
          <li aria-current="page" className="font-bold text-ink">
            {tool.name}
          </li>
        </ol>
      </nav>

      {/* Hero asimétrico: tile a la izquierda, título a la derecha */}
      <header className="mb-10 flex items-start gap-5 motion-safe:animate-fade-in">
        <div
          className={cn(
            'flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border-3 border-ink',
            tool.accent.iconBg
          )}
        >
          <tool.Icon className="h-8 w-8 text-white" strokeWidth={2} />
        </div>

        <div className="min-w-0 pt-1">
          <h1 className="text-3xl font-bold tracking-tight text-ink md:text-4xl">
            {tool.title}
          </h1>
          <p className="mt-2 max-w-xl text-base text-muted-foreground md:text-lg">
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
          className="mb-8 md:mb-0 md:sticky md:top-24 md:self-start"
        />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
