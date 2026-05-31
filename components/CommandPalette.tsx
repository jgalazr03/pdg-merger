'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as Dialog from '@radix-ui/react-dialog';
import { Search } from 'lucide-react';
import { TOOLS, toolsByCategory, type ToolDef } from '@/lib/tools';
import { useRecentTools } from '@/lib/recent-tools';
import { cn } from '@/lib/utils';

/**
 * Command palette global (⌘K / Ctrl+K), el gesto del North Star (Raycast): saltar
 * a cualquier herramienta desde cualquier página sin volver al inicio. Búsqueda
 * insensible a acentos; con la consulta vacía muestra Recientes (o todas si aún
 * no hay historial). Teclado-primero (combobox + listbox con activedescendant).
 *
 * Se abre con el atajo o con el evento `gainco:open-command-palette` (botón del
 * header). Reusa la atmósfera del sistema: papel, borde navy 4px, mono, sin sombra.
 */
const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  toolsByCategory().map((g) => [g.category, g.label])
);

const norm = (s: string) =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export default function CommandPalette() {
  const router = useRouter();
  const recents = useRecentTools(5);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Abrir con ⌘K / Ctrl+K, o con el evento del botón del header.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('gainco:open-command-palette', onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('gainco:open-command-palette', onOpen);
    };
  }, []);

  const q = query.trim();
  const showingRecents = !q && recents.length > 0;
  const results = useMemo<ToolDef[]>(() => {
    if (q) {
      return TOOLS.filter((t) =>
        norm(`${t.name} ${t.title} ${t.tagline}`).includes(norm(q))
      );
    }
    return recents.length ? recents : TOOLS;
  }, [q, recents]);

  // Reiniciar al abrir; mantener el índice activo en rango.
  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
    }
  }, [open]);
  useEffect(() => {
    setActiveIndex(0);
  }, [q]);

  // Desplazar el ítem activo a la vista.
  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-idx="${activeIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, results.length]);

  const go = (tool?: ToolDef) => {
    if (!tool) return;
    setOpen(false);
    router.push(tool.href);
  };

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(results[activeIndex]);
    }
  };

  const listLabel = q ? null : showingRecents ? 'Recientes' : 'Todas las herramientas';

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0" />
        <Dialog.Content
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            inputRef.current?.focus();
          }}
          aria-label="Buscar herramienta"
          className="fixed left-1/2 top-[12vh] z-50 w-[min(40rem,92vw)] -translate-x-1/2 overflow-hidden rounded-xl border-4 border-ink bg-surface data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:slide-in-from-top-2"
        >
          <Dialog.Title className="sr-only">Buscar herramienta</Dialog.Title>

          {/* Campo de búsqueda (combobox). */}
          <div className="flex items-center gap-2.5 border-b-3 border-ink px-4 py-3">
            <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              role="combobox"
              aria-expanded
              aria-controls="cmdk-list"
              aria-activedescendant={
                results[activeIndex] ? `cmdk-opt-${activeIndex}` : undefined
              }
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onInputKeyDown}
              placeholder="Busca una herramienta…"
              aria-label="Buscar herramienta"
              className="w-full bg-transparent text-base font-bold text-ink placeholder:font-normal placeholder:text-muted-foreground focus:outline-none"
            />
          </div>

          {/* Resultados. */}
          <div className="max-h-[min(24rem,56vh)] overflow-y-auto p-2">
            {results.length > 0 ? (
              <>
                {listLabel && (
                  <p className="px-2 pb-1 pt-1.5 text-[0.7rem] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                    {listLabel}
                  </p>
                )}
                <ul id="cmdk-list" ref={listRef} role="listbox" aria-label="Herramientas">
                  {results.map((tool, i) => {
                    const active = i === activeIndex;
                    return (
                      <li
                        key={tool.slug}
                        id={`cmdk-opt-${i}`}
                        data-idx={i}
                        role="option"
                        aria-selected={active}
                        onClick={() => go(tool)}
                        onMouseMove={() => setActiveIndex(i)}
                        className={cn(
                          'group flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-bold transition-colors',
                          active ? 'bg-muted' : ''
                        )}
                      >
                        <tool.Icon
                          className={cn(
                            'h-4 w-4 shrink-0 transition-colors',
                            active ? tool.accent.text : 'text-muted-foreground'
                          )}
                          strokeWidth={2}
                          aria-hidden="true"
                        />
                        <span className="flex-1 text-ink">{tool.name}</span>
                        <span className="shrink-0 text-[0.7rem] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                          {CATEGORY_LABEL[tool.category]}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                Sin resultados para «{q}».
              </p>
            )}
          </div>

          {/* Pie con ayudas de teclado. */}
          <div className="flex items-center justify-between gap-3 border-t-3 border-ink px-4 py-2 text-[0.7rem] font-bold text-muted-foreground">
            <span className="tabular-nums">
              {results.length}{' '}
              {results.length === 1 ? 'herramienta' : 'herramientas'}
            </span>
            <span className="hidden items-center gap-1.5 sm:flex">
              <Kbd>↑↓</Kbd> navegar
              <Kbd>↵</Kbd> abrir
              <Kbd>esc</Kbd> cerrar
            </span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="ml-1 inline-flex select-none items-center rounded border-2 border-ink/25 px-1.5 py-0.5 text-[0.65rem] font-bold leading-none text-muted-foreground first:ml-0">
      {children}
    </kbd>
  );
}
