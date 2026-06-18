import Link from 'next/link';
import { Files, AudioLines, type LucideIcon } from 'lucide-react';
import {
  MODULE_HREF,
  MODULE_LABELS,
  modulesWithTools,
  type ToolModule,
} from '@/lib/tools';
import { cn } from '@/lib/utils';

const MODULE_ICON: Record<ToolModule, LucideIcon> = {
  documentos: Files,
  medios: AudioLines,
};

/**
 * Selector de módulos de primer nivel (Documentos / Medios). Vive sobre el
 * catálogo, por encima de los chips de categoría, para reflejar la jerarquía
 * módulo > categoría. Se autooculta hasta que hay 2+ módulos con herramientas
 * (data-driven), así no aparece mientras solo exista "Documentos".
 */
export default function ModuleSwitcher({ current }: { current: ToolModule }) {
  const modules = modulesWithTools();
  if (modules.length < 2) return null;

  return (
    <nav
      aria-label="Módulos"
      className="mb-8 flex flex-wrap gap-2.5 sm:mb-10"
    >
      {modules.map((module) => {
        const active = module === current;
        const Icon = MODULE_ICON[module];
        const className = cn(
          'inline-flex items-center gap-2 rounded-lg border-3 border-ink px-4 py-2 text-sm font-bold transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2',
          active
            ? 'bg-ink text-white'
            : 'bg-surface text-ink hover-fine:bg-muted active:scale-[0.98]'
        );
        const content = (
          <>
            <Icon className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
            {MODULE_LABELS[module]}
          </>
        );
        return active ? (
          <span key={module} aria-current="page" className={className}>
            {content}
          </span>
        ) : (
          <Link key={module} href={MODULE_HREF[module]} className={className}>
            {content}
          </Link>
        );
      })}
    </nav>
  );
}
