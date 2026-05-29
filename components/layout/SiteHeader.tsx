'use client';

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

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-surface/80 backdrop-blur supports-[backdrop-filter]:bg-surface/70">
      <div className="container mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red focus-visible:ring-offset-2"
          aria-label="Inicio · Herramientas GAINCO"
        >
          <Image
            src="/logos/logo-gainco-color.svg"
            alt="GAINCO"
            width={146}
            height={32}
            className="h-8 w-auto"
            priority
          />
          <span className="hidden items-center gap-2.5 sm:inline-flex">
            <span aria-hidden="true" className="h-4 w-px bg-brand-red/50" />
            <span className="font-display text-sm font-semibold uppercase tracking-wide text-brand-navy/80">
              Herramientas
            </span>
          </span>
        </Link>

        {/* Navegación de escritorio */}
        <nav
          className="hidden items-center gap-1 md:flex"
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
                  'relative flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red focus-visible:ring-offset-2',
                  active
                    ? 'text-brand-navy'
                    : 'text-muted-foreground hover:text-brand-navy'
                )}
              >
                <tool.Icon
                  className={cn('h-4 w-4', active ? tool.accent.text : 'text-current')}
                />
                {tool.name}
                {active && (
                  <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-brand-red" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Navegación móvil */}
        <div className="md:hidden">
          <Sheet>
            <SheetTrigger
              className="inline-flex h-11 w-11 items-center justify-center rounded-md text-ink transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red focus-visible:ring-offset-2"
              aria-label="Abrir menú"
            >
              <Menu className="h-5 w-5" />
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
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
                          'flex items-center gap-3 rounded-md px-3 py-3 text-sm font-semibold transition-colors',
                          active
                            ? 'bg-brand-navy/[0.06] text-brand-navy'
                            : 'text-muted-foreground hover:bg-muted'
                        )}
                      >
                        <tool.Icon className={cn('h-5 w-5', active ? tool.accent.text : 'text-current')} />
                        {tool.name}
                        {active && <span className="ml-auto h-2 w-2 rounded-full bg-brand-red" />}
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
