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
    <header className="sticky top-0 z-40 w-full border-b border-gray-200 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="container mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2"
          aria-label="Inicio · Herramientas PDF GAINCO"
        >
          <Image
            src="/isotipo-gainco.svg"
            alt=""
            width={32}
            height={32}
            className="h-8 w-8"
            priority
          />
          <span className="text-base font-bold text-gray-900">
            Herramientas <span className="text-gray-500">GAINCO</span>
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
                  'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                  tool.accent.ring,
                  active
                    ? cn(tool.accent.soft, tool.accent.text)
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                )}
              >
                <tool.Icon className="h-4 w-4" />
                {tool.name}
              </Link>
            );
          })}
        </nav>

        {/* Navegación móvil */}
        <div className="md:hidden">
          <Sheet>
            <SheetTrigger
              className="inline-flex h-10 w-10 items-center justify-center rounded-md text-gray-700 transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2"
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
                          'flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium transition-colors',
                          active
                            ? cn(tool.accent.soft, tool.accent.text)
                            : 'text-gray-700 hover:bg-gray-100'
                        )}
                      >
                        <tool.Icon className="h-5 w-5" />
                        {tool.name}
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
