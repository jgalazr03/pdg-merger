import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { ToolDef } from '@/lib/tools';
import { cn } from '@/lib/utils';

export default function ToolCard({ tool }: { tool: ToolDef }) {
  return (
    <Link
      href={tool.href}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-white p-6 text-left shadow-sm transition duration-200 ease-out-quint',
        'motion-safe:hover:-translate-y-0.5 hover:border-brand-navy/20 hover:shadow-lg hover:shadow-brand-navy/5',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red focus-visible:ring-offset-2'
      )}
    >
      {/* línea de acento (tono de la herramienta) */}
      <span
        className={cn(
          'absolute inset-x-0 top-0 h-1 origin-left scale-x-0 transition-transform duration-200 ease-out-quint motion-safe:group-hover:scale-x-100',
          tool.accent.line
        )}
      />

      <div
        className={cn(
          'flex h-12 w-12 items-center justify-center rounded-xl shadow-md shadow-brand-navy/20',
          tool.accent.iconBg
        )}
      >
        <tool.Icon className="h-6 w-6 text-white" strokeWidth={1.75} />
      </div>

      <h2 className="mt-4 font-display text-lg font-bold text-brand-navy">
        {tool.title}
      </h2>
      <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted-foreground">
        {tool.tagline}
      </p>

      <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-red">
        Empezar
        <ArrowRight className="h-4 w-4 transition-transform duration-200 ease-out-quint motion-safe:group-hover:translate-x-1" />
      </span>
    </Link>
  );
}
