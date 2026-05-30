'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { TOOLS } from '@/lib/tools';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
  SheetClose,
} from '@/components/ui/sheet';

export default function SiteHeader() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  // Línea activa ÚNICA que se desliza entre tabs (Emil: elemento en pantalla que
  // se mueve → ease-in-out). Medimos el tab activo y movemos una sola barra con
  // transform. `animate: false` la primera vez (y al entrar desde una ruta sin
  // tab activo) para que aparezca en su sitio sin "caminar" desde la izquierda.
  const navRef = useRef<HTMLElement>(null);
  const activeTool = TOOLS.find((tool) => isActive(tool.href));
  const [underline, setUnderline] = useState<{
    x: number;
    w: number;
    animate: boolean;
  } | null>(null);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const activeLink = nav.querySelector<HTMLElement>('[aria-current="page"]');
    if (!activeLink) {
      setUnderline(null);
      return;
    }
    const INSET = 15; // = px-3 del tab: la barra cubre el contenido, no el padding
    setUnderline((prev) => ({
      x: activeLink.offsetLeft + INSET,
      w: Math.max(0, activeLink.offsetWidth - INSET * 2),
      animate: prev !== null,
    }));
  }, [pathname]);

  return (
    <header className="sticky top-0 z-40 w-full bg-surface">
      <div className="container mx-auto flex h-16 max-w-6xl items-center justify-between pl-[max(20px,env(safe-area-inset-left))] pr-[max(20px,env(safe-area-inset-right))]">
        {/*
         * Lockup nativo al sistema: el isotipo de marca + "Herramientas" como
         * nombre de producto en la tipografía mono. Sin divisor ni etiqueta
         * en mayúsculas. El logotipo GAINCO completo vive en el footer.
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

        {/* Navegación de escritorio: una sola línea que se DESLIZA entre tabs.
            En xl+: con 6 herramientas, antes de xl los tabs se apretaban y
            llegaban a envolverse, así que el menú móvil cubre hasta xl. */}
        <nav
          ref={navRef}
          className="relative hidden items-center gap-1 xl:flex"
          aria-label="Herramientas"
        >
          {TOOLS.map((tool) => {
            const active = isActive(tool.href);
            return (
              <Link
                key={tool.slug}
                href={tool.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2',
                  active ? 'text-ink' : 'text-muted-foreground hover:text-ink'
                )}
              >
                <tool.Icon
                  className={cn(
                    'h-4 w-4 transition-colors',
                    active ? tool.accent.text : 'text-current'
                  )}
                />
                {tool.name}
              </Link>
            );
          })}

          {/* Barra activa: viaja con translateX y se dimensiona con scaleX (solo
              transform → GPU). ease-in-out porque es movimiento en pantalla. El
              color cruza al tono del tab destino mientras se desliza. */}
          {underline && (
            <span
              aria-hidden="true"
              className={cn(
                'pointer-events-none absolute -bottom-1 left-0 h-[3px] w-px origin-left',
                activeTool?.accent.line,
                underline.animate &&
                  'transition-[transform,background-color] duration-200 ease-in-out'
              )}
              style={{
                transform: `translateX(${underline.x}px) scaleX(${underline.w})`,
              }}
            />
          )}
        </nav>

        {/* Navegación móvil / tablet (hasta xl) */}
        <div className="xl:hidden">
          <Sheet>
            <SheetTrigger
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg border-3 border-ink bg-surface text-ink transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
              aria-label="Abrir menú"
            >
              <Menu className="h-5 w-5" />
            </SheetTrigger>
            <SheetContent side="right" className="w-[min(20rem,86vw)]">
              <SheetTitle className="mb-4">Herramientas</SheetTitle>
              <nav className="flex flex-col gap-1" aria-label="Herramientas">
                {TOOLS.map((tool) => {
                  const active = isActive(tool.href);
                  return (
                    <SheetClose asChild key={tool.slug}>
                      <Link
                        href={tool.href}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'flex items-center gap-3 rounded-lg border-3 px-3 py-3 text-sm font-bold transition-colors',
                          active
                            ? 'border-ink bg-card text-ink'
                            : 'border-transparent text-muted-foreground hover:bg-muted'
                        )}
                      >
                        <tool.Icon className={cn('h-5 w-5', active ? tool.accent.text : 'text-current')} />
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
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
