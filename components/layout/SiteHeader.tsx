'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Menu, ChevronDown, LayoutGrid } from 'lucide-react';
import { TOOLS, toolsByCategory } from '@/lib/tools';
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

  const [megaOpen, setMegaOpen] = useState(false);
  const megaRef = useRef<HTMLDivElement>(null);

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

  return (
    <header className="sticky top-0 z-40 w-full bg-surface">
      <div className="container mx-auto flex h-16 max-w-6xl items-center justify-between pl-[max(20px,env(safe-area-inset-left))] pr-[max(20px,env(safe-area-inset-right))]">
        {/*
         * Lockup nativo al sistema: el isotipo de marca + "Herramientas" como
         * nombre de producto en la tipografía mono. El logotipo GAINCO completo
         * vive en el footer.
         */}
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
          aria-label="Inicio · Herramientas GAINCO"
        >
          <Image
            src="/logos/isotipo-color.svg"
            alt="GAINCO"
            width={36}
            height={38}
            className="h-9 w-auto"
            priority
          />
          <span className="text-xl font-bold tracking-tight text-ink">
            Herramientas
          </span>
        </Link>

        {/* Escritorio (lg+): chip de herramienta activa + mega-menú propio */}
        <div ref={megaRef} className="relative hidden items-center gap-3 lg:flex">
          {activeTool && (
            <span className="flex items-center gap-2 px-1 text-sm font-bold text-ink">
              <activeTool.Icon className={cn('h-4 w-4', activeTool.accent.text)} />
              {activeTool.name}
            </span>
          )}

          <button
            type="button"
            aria-expanded={megaOpen}
            aria-haspopup="menu"
            onClick={() => setMegaOpen((v) => !v)}
            className="inline-flex items-center gap-2 rounded-lg border-3 border-ink bg-surface px-3 py-2 text-sm font-bold text-ink transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
          >
            <LayoutGrid className="h-4 w-4" />
            Todas las herramientas
            <ChevronDown
              className={cn(
                'h-4 w-4 transition-transform duration-200 ease-out',
                megaOpen && 'rotate-180'
              )}
            />
          </button>

          {megaOpen && (
            <div
              role="menu"
              aria-label="Herramientas"
              className="absolute right-0 top-full z-50 mt-2 w-[min(56rem,90vw)] rounded-lg border-4 border-ink bg-surface p-6 motion-safe:animate-slide-up"
            >
              <div className="grid grid-cols-2 gap-x-8 gap-y-6 lg:grid-cols-3">
                {groups.map((group) => (
                  <div key={group.category}>
                    <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      {group.label}
                    </p>
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
                                'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-bold transition-colors',
                                active
                                  ? 'bg-card text-ink'
                                  : 'text-muted-foreground hover:bg-muted hover:text-ink'
                              )}
                            >
                              <tool.Icon
                                className={cn(
                                  'h-4 w-4 shrink-0',
                                  active ? tool.accent.text : 'text-current'
                                )}
                              />
                              {tool.name}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Móvil / tablet (hasta lg): Sheet con herramientas por categoría */}
        <div className="lg:hidden">
          <Sheet>
            <SheetTrigger
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg border-3 border-ink bg-surface text-ink transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
              aria-label="Abrir menú"
            >
              <Menu className="h-5 w-5" />
            </SheetTrigger>
            <SheetContent
              side="right"
              className="w-[min(22rem,88vw)] overflow-y-auto"
            >
              <SheetTitle className="mb-4">Herramientas</SheetTitle>
              <nav className="flex flex-col gap-6" aria-label="Herramientas">
                {groups.map((group) => (
                  <div key={group.category}>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      {group.label}
                    </p>
                    <div className="flex flex-col gap-1">
                      {group.tools.map((tool) => {
                        const active = isActive(tool.href);
                        return (
                          <SheetClose asChild key={tool.slug}>
                            <Link
                              href={tool.href}
                              aria-current={active ? 'page' : undefined}
                              className={cn(
                                'flex items-center gap-3 rounded-lg border-3 px-3 py-2.5 text-sm font-bold transition-colors',
                                active
                                  ? 'border-ink bg-card text-ink'
                                  : 'border-transparent text-muted-foreground hover:bg-muted'
                              )}
                            >
                              <tool.Icon
                                className={cn(
                                  'h-5 w-5',
                                  active ? tool.accent.text : 'text-current'
                                )}
                              />
                              {tool.name}
                              {active && (
                                <span
                                  className={cn(
                                    'ml-auto h-[10px] w-[10px] rounded-full',
                                    tool.accent.line
                                  )}
                                />
                              )}
                            </Link>
                          </SheetClose>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
