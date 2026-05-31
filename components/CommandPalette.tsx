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
 * a cualquier herramienta desde cualquier página sin volver al inicio.
 *
 *  - Buscando: resultados planos (insensible a acentos), con su categoría a la
 *    derecha para desambiguar.
 *  - Vacío: Recientes arriba + el catálogo COMPLETO por categoría debajo, todo
 *    navegable con teclado (no solo los recientes).
 *
 * Teclado-primero (combobox + listbox con activedescendant; ↑↓/↵/esc). Se abre
 * con el atajo o con el evento `gainco:open-command-palette` (botón del header).
 * Reusa la atmósfera del sistema: papel, borde navy 4px, mono, sin sombra.
 */
const GROUPS = toolsByCategory();
const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  GROUPS.map((g) => [g.category, g.label])
);

const norm = (s: string) =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

type Row =
  | { kind: 'header'; label: string }
  | { kind: 'tool'; tool: ToolDef; index: number };

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

  // Filas a renderizar. El `index` solo corre en las filas seleccionables
  // (herramientas), no en las cabeceras; `flatTools` mapea índice → herramienta
  // para la navegación con teclado.
  const { rows, flatTools } = useMemo(() => {
    const rows: Row[] = [];
    const flatTools: ToolDef[] = [];
    const push = (tool: ToolDef) => {
      rows.push({ kind: 'tool', tool, index: flatTools.length });
      flatTools.push(tool);
    };
    if (q) {
      TOOLS.filter((t) =>
        norm(`${t.name} ${t.title} ${t.tagline}`).includes(norm(q))
      ).forEach(push);
    } else {
      if (recents.length) {
        rows.push({ kind: 'header', label: 'Recientes' });
        recents.forEach(push);
      }
      for (const group of GROUPS) {
        rows.push({ kind: 'header', label: group.label });
        group.tools.forEach(push);
      }
    }
    return { rows, flatTools };
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
  }, [activeIndex, flatTools.length]);

  const go = (tool?: ToolDef) => {
    if (!tool) return;
    setOpen(false);
    router.push(tool.href);
  };

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, flatTools.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(flatTools[activeIndex]);
    }
  };

  const count = q ? flatTools.length : TOOLS.length;

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
          aria-describedby={undefined}
          className="fixed left-1/2 top-[12vh] z-50 flex max-h-[76vh] w-[min(40rem,92vw)] -translate-x-1/2 flex-col overflow-hidden rounded-xl border-4 border-ink bg-surface data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:slide-in-from-top-2"
        >
          <Dialog.Title className="sr-only">Buscar herramienta</Dialog.Title>

          {/* Campo de búsqueda (combobox). */}
          <div className="flex shrink-0 items-center gap-2.5 border-b-3 border-ink px-4 py-3">
            <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              role="combobox"
              aria-expanded
              aria-controls="cmdk-list"
              aria-activedescendant={
                flatTools[activeIndex] ? `cmdk-opt-${activeIndex}` : undefined
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
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {flatTools.length > 0 ? (
              <ul id="cmdk-list" ref={listRef} role="listbox" aria-label="Herramientas">
                {rows.map((row, i) => {
                  if (row.kind === 'header') {
                    return (
                      <li
                        key={`h-${i}`}
                        role="presentation"
                        className="px-2 pb-1 pt-3 text-[0.7rem] font-bold uppercase tracking-[0.15em] text-muted-foreground first:pt-1.5"
                      >
                        {row.label}
                      </li>
                    );
                  }
                  const { tool, index } = row;
                  const active = index === activeIndex;
                  const Icon = tool.Icon;
                  return (
                    <li
                      key={`${tool.slug}-${index}`}
                      id={`cmdk-opt-${index}`}
                      data-idx={index}
                      role="option"
                      aria-selected={active}
                      onClick={() => go(tool)}
                      onMouseMove={() => setActiveIndex(index)}
                      className={cn(
                        'group flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-bold transition-colors',
                        active ? 'bg-muted' : ''
                      )}
                    >
                      <Icon
                        className={cn(
                          'h-4 w-4 shrink-0 transition-colors',
                          active ? tool.accent.text : 'text-muted-foreground'
                        )}
                        strokeWidth={2}
                        aria-hidden="true"
                      />
                      <span className="flex-1 text-ink">{tool.name}</span>
                      {q && (
                        <span className="shrink-0 text-[0.7rem] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                          {CATEGORY_LABEL[tool.category]}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                Sin resultados para «{q}».
              </p>
            )}
          </div>

          {/* Pie con ayudas de teclado. */}
          <div className="flex shrink-0 items-center justify-between gap-3 border-t-3 border-ink px-4 py-2 text-[0.7rem] font-bold text-muted-foreground">
            <span className="tabular-nums">
              {count} {count === 1 ? 'herramienta' : 'herramientas'}
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
