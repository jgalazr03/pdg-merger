'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export type DownloadItem = { label: string; onSelect: () => void };

/**
 * Botón "Descargar" con menú desplegable de formatos. Propio (sin Radix) para
 * no arriesgar el bug de bundling de Next 13.5.1: botón + lista absoluta con
 * cierre por click-fuera y Escape. Agrupa las descargas y libera el flujo
 * principal de tantos botones.
 */
export default function DownloadMenu({
  items,
  className,
}: {
  items: DownloadItem[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <Button
        type="button"
        className={className}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Download className="mr-2 h-4 w-4" />
        Descargar
        <ChevronDown
          className={cn(
            'ml-2 h-4 w-4 transition-transform duration-150',
            open && 'rotate-180'
          )}
        />
      </Button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 z-20 mt-2 min-w-[15rem] overflow-hidden rounded-lg border-3 border-ink bg-card sm:left-auto sm:right-0"
        >
          {items.map((it, i) => (
            <button
              key={i}
              role="menuitem"
              type="button"
              onClick={() => {
                it.onSelect();
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 border-b-2 border-ink/10 px-3 py-2.5 text-left text-sm font-medium text-ink transition-colors duration-150 last:border-b-0 hover-fine:bg-muted focus-visible:bg-muted focus-visible:outline-none"
            >
              <Download className="h-4 w-4 shrink-0 text-muted-foreground" />
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
