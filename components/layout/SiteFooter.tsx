import Link from 'next/link';
import Image from 'next/image';
import { ShieldCheck } from 'lucide-react';
import { toolsByCategory } from '@/lib/tools';
import { cn } from '@/lib/utils';

/**
 * Footer sobre navy de marca. En el footer el COLOR = identidad de herramienta:
 * cada enlace lleva su ícono en el tono claro de su herramienta (accent.onDark,
 * legible sobre navy). Con el catálogo ampliado las herramientas se reparten en
 * columnas por categoría. El resto del cromo (escudo, eyebrow) va neutro en
 * blanco para no competir con los colores de herramienta.
 *
 * El footer va PEGADO al contenido (sin margen superior ni costura blanca): el
 * cambio papel → navy ya lo separa, y un margen transparente dejaría ver el
 * body navy del overscroll como una franja extra (ver globals.css).
 */
export default function SiteFooter() {
  const year = new Date().getFullYear();
  const groups = toolsByCategory();

  return (
    <footer className="bg-brand-navy pb-[env(safe-area-inset-bottom)] text-white/80">
      <div className="container mx-auto max-w-6xl py-14 pl-[max(20px,env(safe-area-inset-left))] pr-[max(20px,env(safe-area-inset-right))]">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,18rem)_1fr] lg:gap-16">
          {/* Marca + propuesta + privacidad */}
          <div className="max-w-md">
            <Image
              src="/logos/logo-gainco-white.svg"
              alt="GAINCO"
              width={150}
              height={33}
              className="h-8 w-auto"
            />
            <p className="mt-5 text-sm leading-relaxed text-white/70">
              Une, divide, comprime, convierte y edita archivos PDF, directo
              desde tu navegador.
            </p>
            <p className="mt-6 flex items-center gap-2.5 text-sm font-bold text-white">
              <ShieldCheck
                className="h-5 w-5 shrink-0 text-white"
                strokeWidth={2.25}
                aria-hidden="true"
              />
              Tus archivos nunca salen de tu equipo.
            </p>
          </div>

          {/* Herramientas por categoría */}
          <nav
            aria-label="Herramientas"
            className="grid grid-cols-2 gap-x-6 gap-y-9 sm:grid-cols-3 lg:grid-cols-5"
          >
            {groups.map((group) => (
              <div key={group.category}>
                <div className="mb-4">
                  {/* Pestaña con borde sobre regla, invertida a blanco sobre navy. */}
                  <div className="flex">
                    <p className="rounded-t-lg border-3 border-b-0 border-white px-3 py-1.5 text-xs font-bold uppercase leading-none tracking-[0.2em] text-white">
                      {group.label}
                    </p>
                  </div>
                  <div aria-hidden="true" className="h-[3px] w-full bg-white" />
                </div>
                <ul className="space-y-3">
                  {group.tools.map((tool) => (
                    <li key={tool.slug}>
                      <Link
                        href={tool.href}
                        className="group inline-flex items-center gap-2.5 text-sm font-bold text-white/75 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-navy"
                      >
                        <tool.Icon
                          className={cn('h-4 w-4 shrink-0', tool.accent.onDark)}
                          strokeWidth={2}
                          aria-hidden="true"
                        />
                        <span className="decoration-2 underline-offset-4 group-hover:underline">
                          {tool.name}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        {/* Barra inferior */}
        <div className="mt-12 border-t-2 border-white/15 pt-6 text-xs text-white/55">
          © {year} GAINCO. Todos los derechos reservados.
        </div>
      </div>
    </footer>
  );
}
