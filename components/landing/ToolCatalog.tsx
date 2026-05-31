'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Search, X } from 'lucide-react';
import {
  TOOLS,
  toolsByCategory,
  type ToolCategory,
} from '@/lib/tools';
import { useRecentTools } from '@/lib/recent-tools';
import { cn } from '@/lib/utils';
import ToolCard from './ToolCard';

/**
 * Catálogo de herramientas como LANZADOR (no como muro de tarjetas).
 *
 * Con 25+ herramientas, una rejilla plana abruma. El patrón de las mejores
 * herramientas (Raycast, Linear, Vercel) es no esconder el catálogo sino darle
 * acceso rápido: un buscador tipo command-bar + filtros de categoría que llevan
 * la carga de "muro" a "navegable en un tap o un tecleo".
 *
 *  - Buscar: filtra al instante, insensible a mayúsculas y acentos, sobre nombre
 *    y descripción. Atajo "/" para enfocar (patrón big tech); Escape limpia.
 *  - Filtrar: chips de categoría; el estado seleccionado se rellena en navy.
 *  - Vista por defecto (sin filtro): todas las secciones agrupadas, descubribles
 *    y renderizadas en el HTML (SSR) para no perder SEO.
 *
 * La cascada de entrada corre SOLO en el montaje inicial; al filtrar, los
 * resultados aparecen al instante (sin re-animar en cada tecla).
 */
const STAGGER_STEP = 40; // ms entre elementos consecutivos
const STAGGER_CAP = 12; // a partir de aquí, todo entra a la vez
const STAGGER_BASE = 50; // arranca justo tras el fade del hero
const revealDelay = (order: number) =>
  STAGGER_BASE + Math.min(order, STAGGER_CAP) * STAGGER_STEP;

const norm = (s: string) =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export default function ToolCatalog() {
  const groups = toolsByCategory();
  const recents = useRecentTools(5);
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState<ToolCategory | 'all'>('all');
  const [animateInitial, setAnimateInitial] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  // La cascada solo tiene sentido la primera vez; tras ella, filtrar es
  // instantáneo (cualquier re-render no vuelve a animar).
  useEffect(() => {
    const id = window.setTimeout(() => setAnimateInitial(false), 1200);
    return () => window.clearTimeout(id);
  }, []);

  // Atajo "/" para enfocar el buscador (Raycast/Linear/Vercel), salvo cuando ya
  // se escribe en otro campo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || el?.isContentEditable) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const q = query.trim();
  const isSearching = q.length > 0;

  const chips: { key: ToolCategory | 'all'; label: string }[] = [
    { key: 'all', label: 'Todas' },
    ...groups.map((g) => ({ key: g.category, label: g.label })),
  ];

  // Resultados de búsqueda (planos), respetando la categoría activa.
  const results = isSearching
    ? TOOLS.filter(
        (t) =>
          (cat === 'all' || t.category === cat) &&
          norm(`${t.name} ${t.tagline}`).includes(norm(q))
      )
    : [];

  // Vista de navegación (sin búsqueda): todas las secciones o solo la activa.
  const browseGroups =
    cat === 'all' ? groups : groups.filter((g) => g.category === cat);
  const doAnimate = animateInitial && cat === 'all';

  const clear = () => {
    setQuery('');
    inputRef.current?.focus();
  };

  return (
    <div>
      {/* --- Buscar + filtros (la cabecera del lanzador) --- */}
      <div className="mb-10 sm:mb-12">
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && query) {
                e.preventDefault();
                setQuery('');
              }
            }}
            placeholder="Busca una herramienta…"
            aria-label="Buscar herramienta"
            className="w-full rounded-lg border-3 border-ink bg-surface py-2.5 pl-9 pr-11 text-base font-bold text-ink placeholder:font-normal placeholder:text-muted-foreground focus:outline-none focus-visible:bg-muted focus-visible:outline-none"
          />
          {query ? (
            <button
              type="button"
              onClick={clear}
              aria-label="Limpiar búsqueda"
              className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 select-none rounded border-2 border-ink/30 px-1.5 py-0.5 text-[0.7rem] font-bold leading-none text-muted-foreground sm:block">
              /
            </kbd>
          )}
        </div>

        {/* Chips de categoría: una forma de acotar el muro en un solo tap. */}
        <div
          role="group"
          aria-label="Filtrar por categoría"
          className="mt-4 flex flex-wrap gap-2"
        >
          {chips.map((chip) => {
            const active = cat === chip.key;
            return (
              <button
                key={chip.key}
                type="button"
                aria-pressed={active}
                onClick={() => setCat(chip.key)}
                className={cn(
                  'rounded-lg border-3 border-ink px-3 py-1.5 text-sm font-bold transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2',
                  active
                    ? 'bg-ink text-white'
                    : 'bg-surface text-ink hover:bg-muted'
                )}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Recientes (solo en navegación, no al buscar/filtrar): atajo de un toque
          a lo último usado. Guardado solo en el equipo; vacío hasta montar. */}
      {!isSearching && cat === 'all' && recents.length > 0 && (
        <div className="mb-10 sm:mb-12">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">
            Recientes
          </p>
          <div className="flex flex-wrap gap-2.5">
            {recents.map((tool) => (
              <Link
                key={tool.slug}
                href={tool.href}
                className="group inline-flex items-center gap-2 rounded-lg border-3 border-ink bg-card px-3 py-2 text-sm font-bold text-ink transition-[background-color,transform] duration-150 ease-out hover:bg-muted active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
              >
                <tool.Icon
                  className={cn('h-4 w-4 shrink-0', tool.accent.text)}
                  strokeWidth={2}
                  aria-hidden="true"
                />
                {tool.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* --- Resultados --- */}
      {isSearching ? (
        results.length > 0 ? (
          <>
            <p
              aria-live="polite"
              className="mb-5 text-sm font-bold tabular-nums text-muted-foreground"
            >
              {results.length}{' '}
              {results.length === 1 ? 'resultado' : 'resultados'}
            </p>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {results.map((tool) => (
                <ToolCard key={tool.slug} tool={tool} />
              ))}
            </div>
          </>
        ) : (
          <div className="rounded-lg border-4 border-ink bg-card p-8 text-center">
            <p aria-live="polite" className="text-base font-bold text-ink">
              Sin resultados para «{q}».
            </p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
              Prueba con otro término o limpia la búsqueda para ver todas las
              herramientas.
            </p>
            <button
              type="button"
              onClick={clear}
              className="mt-6 inline-flex items-center gap-2 rounded-lg border-3 border-ink bg-surface px-4 py-2 text-sm font-bold text-ink transition-colors hover:bg-muted active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
            >
              <X className="h-4 w-4" />
              Limpiar búsqueda
            </button>
          </div>
        )
      ) : (
        <div className="space-y-12 sm:space-y-14">
          {(() => {
            // Orden de revelado en lectura (cabecera, luego sus tarjetas). El
            // contador se reinicia cada render; mutarlo es seguro (síncrono).
            let order = 0;
            const next = () => order++;
            return browseGroups.map((group) => {
              const headerDelay = doAnimate ? revealDelay(next()) : undefined;
              return (
                <section
                  key={group.category}
                  aria-labelledby={`cat-${group.category}`}
                >
                  <div
                    className={cn(
                      'mb-6',
                      headerDelay != null && 'motion-safe:animate-slide-up'
                    )}
                    style={
                      headerDelay != null
                        ? { animationDelay: `${headerDelay}ms` }
                        : undefined
                    }
                  >
                    {/* Pestaña con borde apoyada sobre regla navy. */}
                    <div className="flex">
                      <h2
                        id={`cat-${group.category}`}
                        className="rounded-t-lg border-3 border-b-0 border-ink bg-surface px-4 py-2 text-sm font-bold uppercase leading-none tracking-[0.2em] text-ink"
                      >
                        {group.label}
                      </h2>
                    </div>
                    <div aria-hidden="true" className="h-[3px] w-full bg-ink" />
                  </div>
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {group.tools.map((tool) => (
                      <ToolCard
                        key={tool.slug}
                        tool={tool}
                        delayMs={doAnimate ? revealDelay(next()) : undefined}
                      />
                    ))}
                  </div>
                </section>
              );
            });
          })()}
        </div>
      )}
    </div>
  );
}
