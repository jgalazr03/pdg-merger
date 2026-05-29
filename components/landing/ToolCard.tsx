import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { ToolDef } from '@/lib/tools';
import { cn } from '@/lib/utils';

export default function ToolCard({ tool }: { tool: ToolDef }) {
  return (
    <Link
      href={tool.href}
      className={cn(
        'group relative flex flex-col rounded-2xl border border-gray-200 bg-white p-6 text-left shadow-sm transition-all',
        'bg-gradient-to-b to-white',
        tool.accent.cardGradient,
        'motion-safe:hover:-translate-y-1 hover:border-gray-300 hover:shadow-md',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        tool.accent.ring
      )}
    >
      <div
        className={cn(
          'inline-flex h-12 w-12 items-center justify-center rounded-xl',
          tool.accent.iconBg
        )}
      >
        <tool.Icon className={cn('h-6 w-6', tool.accent.text)} />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-gray-900">{tool.title}</h2>
      <p className="mt-1 flex-1 text-sm text-gray-600">{tool.tagline}</p>
      <span
        className={cn(
          'mt-4 inline-flex items-center gap-1 text-sm font-medium',
          tool.accent.text
        )}
      >
        Empezar
        <ArrowRight className="h-4 w-4 transition-transform motion-safe:group-hover:translate-x-1" />
      </span>
    </Link>
  );
}
