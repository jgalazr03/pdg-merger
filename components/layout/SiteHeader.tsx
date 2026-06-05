'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Menu, ChevronDown, LayoutGrid, Search } from 'lucide-react';
import { TOOLS, toolsByCategory, type ToolDef } from '@/lib/tools';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
  SheetClose,
} from '@/components/ui/sheet';

/**
 * Cabecera. Con el catálogo ampliado (25+ herramientas) una barra de tabs en
 * línea no cabe: se sustituye por un disparador "Todas las herramientas" que
 * abre un panel categorizado.
 *  - Escritorio (lg+): mega-menú propio (estado + clic-fuera + Escape), sin
 *    Radix extra; junto a un chip con la herramienta activa.
 *  - Móvil/tablet (<lg): el Sheet de marca, con las herramientas por categoría.
 */
export default function SiteHeader() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);
  const activeTool = TOOLS.find((tool) => isActive(tool.href));
  const groups = toolsByCategory();

  // Distribución del mega-menú en 3 columnas verticales INDEPENDIENTES (no una
  // rejilla que alinea filas y deja huecos): como la columna "Editar" es larga,
  // "Optimizar" se acomoda bajo "Organizar" (col 0) y "Seguridad y privacidad"
  // bajo "Convertir" (col 2). Las categorías nuevas no mapeadas caen en la
  // columna más corta, así el menú sigue siendo data-driven.
  const PREFERRED_COLUMN: Record<string, number> = {
    organizar: 0,
    optimizar: 0,
    editar: 1,
    convertir: 2,
    seguridad: 2,
  };
  const menuColumns: (typeof groups)[] = [[], [], []];
  for (const group of groups) {
    let col = PREFERRED_COLUMN[group.category];
    if (col === undefined) {
      const counts = menuColumns.map((c) =>
        c.reduce((n, g) => n + g.tools.length, 0)
      );
      col = counts.indexOf(Math.min(...counts));
    }
    menuColumns[col].push(group);
  }

  const [megaOpen, setMegaOpen] = useState(false);
  const megaRef = useRef<HTMLDivElement>(null);

  // Montaje con transición de entrada/salida (Emil): el panel EMERGE del
  // disparador (origin top-right) al abrir y se desvanece al cerrar, en vez de
  // aparecer/desaparecer de golpe. Se monta cerrado y se hace visible en el
  // siguiente frame para que la transición de entrada se dispare; al cerrar se
  // desmonta tras la duración de salida.
  const [megaMounted, setMegaMounted] = useState(false);
  const [megaVisible, setMegaVisible] = useState(false);
  useEffect(() => {
    if (megaOpen) {
      setMegaMounted(true);
      const raf = requestAnimationFrame(() => setMegaVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    setMegaVisible(false);
    const t = window.setTimeout(() => setMegaMounted(false), 180);
    return () => window.clearTimeout(t);
  }, [megaOpen]);

  // --- Menú móvil (Sheet): buscador + categorías colapsables ---
  const [menuQuery, setMenuQuery] = useState('');
  const [openCats, setOpenCats] = useState<Set<string>>(new Set());
  // Foco al abrir: al título, NO al buscador. Como el buscador es el primer
  // enfocable del panel, Radix lo autoenfocaba y abría el teclado en móvil; el
  // teclado solo debe salir cuando el usuario toca el buscador.
  const menuTitleRef = useRef<HTMLHeadingElement>(null);

  // Etiqueta del atajo del command palette según plataforma (⌘ en Mac, Ctrl en
  // el resto). Inicia en '⌘' y se corrige tras montar para no romper hidratación.
  const [modKey, setModKey] = useState('⌘');
  useEffect(() => {
    const isMac = /mac|iphone|ipad/i.test(
      navigator.platform || navigator.userAgent || ''
    );
    if (!isMac) setModKey('Ctrl');
  }, []);

  // Al navegar, deja expandida SOLO la categoría de la herramienta activa (el
  // resto colapsado) para abrir el menú con el mínimo scroll.
  useEffect(() => {
    setOpenCats(new Set(activeTool ? [activeTool.category] : []));
  }, [pathname]);

  // Cerrar el mega-menú al navegar a otra ruta.
  useEffect(() => {
    setMegaOpen(false);
  }, [pathname]);

  // Cerrar al hacer clic fuera o con Escape (movimiento mínimo, accesible).
  useEffect(() => {
    if (!megaOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (megaRef.current && !megaRef.current.contains(e.target as Node)) {
        setMegaOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMegaOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [megaOpen]);

  // Búsqueda insensible a mayúsculas y acentos sobre el nombre de la herramienta.
  const norm = (s: string) =>
    s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const menuResults =
    menuQuery.trim().length > 0
      ? TOOLS.filter((t) => norm(t.name).includes(norm(menuQuery)))
      : [];
  const toggleCat = (c: string) =>
    setOpenCats((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });

  // --- Peek de scroll (móvil): cuando una sección desplegada desborda el panel,
  // el contenido se corta EN SECO media fila antes del borde (máscara dura, sin
  // degradado: dos paradas en el mismo punto) para que asome la siguiente
  // herramienta y se note que hay más abajo. Se apaga al llegar al final para no
  // fingir contenido inexistente.
  //  - `moreBelow`: hay contenido oculto bajo el viewport (scroll + ResizeObserver,
  //    que además capta el crecimiento durante la animación de despliegue).
  //  - `peekPx`: media fila, medida de una fila real (la rejilla de espaciado del
  //    sistema es propia, no la de Tailwind, así que no se hardcodea).
  // Callback ref porque el <nav> vive en el portal del Sheet (solo existe abierto).
  const [moreBelow, setMoreBelow] = useState(false);
  const [peekPx, setPeekPx] = useState(0);
  const navCleanupRef = useRef<(() => void) | null>(null);
  const setNavRef = useCallback((node: HTMLElement | null) => {
    navCleanupRef.current?.();
    navCleanupRef.current = null;
    if (!node) {
      setMoreBelow(false);
      return;
    }
    const updateMore = () => {
      const more = node.scrollHeight - node.scrollTop - node.clientHeight > 2;
      setMoreBelow((prev) => (prev !== more ? more : prev));
    };
    const measure = () => {
      const row = node.querySelector('[data-tool-row]') as HTMLElement | null;
      if (!row) return;
      const half = Math.round(row.offsetHeight / 2);
      setPeekPx((prev) => (prev !== half ? half : prev));
    };
    const onContentChange = () => {
      measure();
      updateMore();
    };
    onContentChange();
    node.addEventListener('scroll', updateMore, { passive: true });
    const ro = new ResizeObserver(onContentChange);
    ro.observe(node);
    if (node.firstElementChild) ro.observe(node.firstElementChild);
    navCleanupRef.current = () => {
      node.removeEventListener('scroll', updateMore);
      ro.disconnect();
    };
  }, []);

  // Fila de herramienta del menú móvil (reutilizada en búsqueda y categorías).
  const renderToolLink = (tool: ToolDef, tabbable = true) => {
    const active = isActive(tool.href);
    return (
      <SheetClose asChild key={tool.slug}>
        <Link
          href={tool.href}
          data-tool-row=""
          tabIndex={tabbable ? undefined : -1}
          aria-current={active ? 'page' : undefined}
          className={cn(
            'flex items-center gap-3 rounded-lg border-3 px-3 py-2.5 text-sm font-bold transition-colors',
            active
              ? 'border-ink bg-card text-ink'
              : 'border-transparent text-muted-foreground hover-fine:bg-muted active:bg-muted'
          )}
        >
          <tool.Icon
            className={cn(
              'h-5 w-5 shrink-0',
              active ? tool.accent.text : 'text-current'
            )}
          />
          <span className="min-w-0 flex-1">{tool.name}</span>
          {active && (
            <span
              className={cn(
                'h-[10px] w-[10px] shrink-0 rounded-full',
                tool.accent.line
              )}
            />
          )}
        </Link>
      </SheetClose>
    );
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b-4 border-ink bg-surface">
      <div className="container mx-auto flex h-16 max-w-6xl items-center justify-between pl-[max(20px,env(safe-area-inset-left))] pr-[max(20px,env(safe-area-inset-right))]">
        {/*
         * Lockup nativo al sistema: el icono de herramientas + "Herramientas"
         * como nombre de producto en la tipografía mono. El logotipo GAINCO
         * completo vive en el footer.
         */}
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
          aria-label="Inicio · Herramientas GAINCO"
        >
          <Image
            src="/logos/Icono_herramientas.svg"
            alt="Herramientas GAINCO"
            width={36}
            height={36}
            className="h-9 w-9"
            priority
          />
          <span className="text-xl font-bold tracking-tight text-ink">
            Herramientas
          </span>
        </Link>

        {/* Escritorio (lg+): buscar (⌘K) + mega-menú propio. La herramienta activa
            se indica en el breadcrumb de la página (ToolShell), no aquí. */}
        <div ref={megaRef} className="relative hidden items-center gap-3 lg:flex">
          {/* Acceso al command palette global (descubre el atajo ⌘K/Ctrl+K). */}
          <button
            type="button"
            onClick={() =>
              window.dispatchEvent(new Event('gainco:open-command-palette'))
            }
            aria-label="Buscar herramienta"
            className="inline-flex items-center gap-2 rounded-lg border-3 border-ink bg-surface px-3 py-2 text-sm font-bold text-ink transition-[background-color,transform] duration-150 ease-out hover-fine:bg-muted active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
          >
            <Search className="h-4 w-4" />
            Buscar
            <kbd className="ml-1 select-none rounded border-2 border-ink/25 px-1.5 py-0.5 text-[0.7rem] font-bold leading-none text-muted-foreground">
              {modKey === '⌘' ? '⌘K' : 'Ctrl K'}
            </kbd>
          </button>

          <button
            type="button"
            aria-expanded={megaOpen}
            aria-haspopup="menu"
            onClick={() => setMegaOpen((v) => !v)}
            className="inline-flex items-center gap-2 rounded-lg border-3 border-ink bg-surface px-3 py-2 text-sm font-bold text-ink transition-[background-color,transform] duration-150 ease-out hover-fine:bg-muted active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
          >
            <LayoutGrid className="h-4 w-4" />
            Todas las herramientas
            <ChevronDown
              className={cn(
                'h-4 w-4 transition-transform duration-150 ease-out',
                megaOpen && 'rotate-180'
              )}
            />
          </button>

          {megaMounted && (
            <div
              role="menu"
              aria-label="Herramientas"
              className={cn(
                'absolute right-0 top-full z-50 mt-2 w-[min(56rem,90vw)] origin-top-right rounded-lg border-4 border-ink bg-surface p-6 transition duration-150 ease-out motion-reduce:transition-none',
                megaVisible
                  ? 'translate-y-0 scale-100 opacity-100'
                  : 'pointer-events-none -translate-y-1 scale-95 opacity-0'
              )}
            >
              <div className="grid grid-cols-3 gap-x-8">
                {menuColumns.map((column, i) => (
                  <div key={i} className="space-y-6">
                    {column.map((group) => (
                      <div key={group.category}>
                        <div className="mb-3">
                          {/* Pestaña con borde apoyada sobre una regla navy. */}
                          <div className="flex">
                            <p className="rounded-t-lg border-3 border-b-0 border-ink bg-surface px-3 py-1.5 text-xs font-bold uppercase leading-none tracking-[0.2em] text-ink">
                              {group.label}
                            </p>
                          </div>
                          <div aria-hidden="true" className="h-[3px] w-full bg-ink" />
                        </div>
                        <ul className="space-y-0.5">
                          {group.tools.map((tool) => {
                            const active = isActive(tool.href);
                            return (
                              <li key={tool.slug}>
                                <Link
                                  href={tool.href}
                                  role="menuitem"
                                  aria-current={active ? 'page' : undefined}
                                  className={cn(
                                    'group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2',
                                    active
                                      ? 'bg-card text-ink'
                                      : 'text-muted-foreground hover-fine:text-ink'
                                  )}
                                >
                                  {/* Hover estilo footer: el ícono toma su color
                                      y la frase se subraya (sin relleno de fondo). */}
                                  <tool.Icon
                                    className={cn(
                                      'h-4 w-4 shrink-0 transition-colors',
                                      active
                                        ? tool.accent.text
                                        : cn('text-current', tool.accent.iconHover)
                                    )}
                                  />
                                  <span className="decoration-2 underline-offset-4 group-hover-fine:underline">
                                    {tool.name}
                                  </span>
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Móvil / tablet (hasta lg): Sheet con buscador + categorías colapsables */}
        <div className="lg:hidden">
          <Sheet onOpenChange={(o) => !o && setMenuQuery('')}>
            <SheetTrigger
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg border-3 border-ink bg-surface text-ink transition-[background-color,transform] duration-150 ease-out hover-fine:bg-muted active:scale-[0.98] active:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
              aria-label="Abrir menú"
            >
              <Menu className="h-5 w-5" />
            </SheetTrigger>
            <SheetContent
              side="right"
              className="flex w-[min(22rem,88vw)] flex-col"
              onOpenAutoFocus={(e) => {
                e.preventDefault();
                menuTitleRef.current?.focus();
              }}
            >
              <SheetTitle
                ref={menuTitleRef}
                tabIndex={-1}
                className="mb-4 shrink-0 outline-none"
              >
                Herramientas
              </SheetTitle>

              {/* Buscador: salto directo a cualquiera de las herramientas */}
              <div className="relative mb-4 shrink-0">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  type="text"
                  value={menuQuery}
                  onChange={(e) => setMenuQuery(e.target.value)}
                  placeholder="Buscar herramienta…"
                  aria-label="Buscar herramienta"
                  className="w-full rounded-lg border-3 border-ink bg-surface py-2.5 pl-9 pr-3 text-base font-bold text-ink placeholder:font-normal placeholder:text-muted-foreground focus:outline-none focus-visible:outline-none focus-visible:bg-muted"
                />
              </div>

              <nav
                ref={setNavRef}
                className="-mr-2 flex-1 overflow-y-auto pr-2"
                aria-label="Herramientas"
                style={
                  moreBelow && peekPx
                    ? {
                        WebkitMaskImage: `linear-gradient(to bottom, #000 calc(100% - ${peekPx}px), transparent calc(100% - ${peekPx}px))`,
                        maskImage: `linear-gradient(to bottom, #000 calc(100% - ${peekPx}px), transparent calc(100% - ${peekPx}px))`,
                      }
                    : undefined
                }
              >
                {/* Envoltorio estable: el ResizeObserver observa SIEMPRE este
                    nodo (no cambia de identidad al alternar búsqueda/categorías),
                    así capta cualquier cambio de alto del contenido. */}
                <div>
                {menuQuery.trim() ? (
                  /* Resultados de búsqueda: lista plana */
                  menuResults.length > 0 ? (
                    <div className="flex flex-col gap-1">
                      {menuResults.map((tool) => renderToolLink(tool))}
                    </div>
                  ) : (
                    <p className="px-1 py-8 text-center text-sm text-muted-foreground">
                      Sin resultados para “{menuQuery}”.
                    </p>
                  )
                ) : (
                  /* Categorías colapsables (abre solo 5 encabezados) */
                  <div className="flex flex-col gap-3">
                    {groups.map((group) => {
                      const open = openCats.has(group.category);
                      return (
                        <div key={group.category}>
                          {/* Encabezado-disparador: fila uniforme sobre regla
                              navy. Filas de igual alto, etiqueta a la izquierda y
                              conteo + chevron alineados a la derecha (sin
                              pestañas de ancho variable ni números flotantes). */}
                          <button
                            type="button"
                            onClick={() => toggleCat(group.category)}
                            aria-expanded={open}
                            className="flex w-full items-center gap-3 rounded-t border-b-[3px] border-ink py-2.5 text-left transition-colors duration-150 ease-out hover-fine:bg-muted active:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
                          >
                            <span className="flex-1 whitespace-nowrap text-xs font-bold uppercase tracking-[0.15em] text-ink">
                              {group.label}
                            </span>
                            <ChevronDown
                              aria-hidden="true"
                              className={cn(
                                'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150 ease-out motion-reduce:transition-none',
                                open && 'rotate-180'
                              )}
                            />
                          </button>
                          {/* Reveal SOLO por opacidad (filosofía de Emil / Raycast:
                              no animar la altura). El alto colapsa/expande al
                              instante vía grid-rows 0fr/1fr SIN transición —un único
                              reflow, no por-frame, así que cumple la regla de oro de
                              animar solo transform/opacity—; los íconos funden juntos
                              en 150ms, concurrentes con el chevron.

                              Por qué se quitó el "crecer": animar grid-template-rows
                              destapaba los ítems con una ventana de recorte cuya
                              velocidad = altura/duración, de modo que en una sección
                              corta los revelaba "uno por uno" y en una larga "de
                              golpe". Sin animar la altura desaparece el recorte
                              progresivo (y con él toda la maquinaria de dos fases /
                              duración proporcional). El contenido sigue montado para
                              conservar el gating de tabIndex y el aria-hidden. */}
                          <div
                            className={cn(
                              'grid',
                              open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                            )}
                          >
                            <div className="overflow-hidden" aria-hidden={!open}>
                              <div
                                className={cn(
                                  'mt-2 flex flex-col gap-1 transition-opacity duration-150 ease-out motion-reduce:transition-none',
                                  open ? 'opacity-100' : 'opacity-0'
                                )}
                              >
                                {group.tools.map((tool) =>
                                  renderToolLink(tool, open)
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                </div>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
