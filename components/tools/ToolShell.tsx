import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { ToolDef } from '@/lib/tools';
import { cn } from '@/lib/utils';
import StepIndicator from './StepIndicator';

/**
 * Cáscara común de cada herramienta: breadcrumb + hero (ícono, título,
 * descripción) + indicador de pasos. El contenido específico se pasa como
 * children.
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
    <div className="container mx-auto max-w-4xl px-4 py-8 md:py-10">
      <nav aria-label="Ruta de navegación" className="mb-6">
        <ol className="flex items-center gap-1 text-sm text-gray-500">
          <li>
            <Link
              href="/"
              className="rounded transition-colors hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2"
            >
              Inicio
            </Link>
          </li>
          <li aria-hidden="true">
            <ChevronRight className="h-4 w-4" />
          </li>
          <li aria-current="page" className="font-medium text-gray-900">
            {tool.name}
          </li>
        </ol>
      </nav>

      <div className="mb-10 text-center motion-safe:animate-fade-in">
        <div
          className={cn(
            'mb-5 inline-flex h-16 w-16 items-center justify-center rounded-2xl',
            tool.accent.iconBg
          )}
        >
          <tool.Icon className={cn('h-8 w-8', tool.accent.text)} />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">
          {tool.title}
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-lg text-gray-600">
          {tool.tagline}{' '}
          <span className="text-gray-500">
            Todo se procesa en tu navegador.
          </span>
        </p>
      </div>

      <StepIndicator current={step} accent={tool.accent} />

      {children}
    </div>
  );
}
