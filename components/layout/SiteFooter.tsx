import Link from 'next/link';
import Image from 'next/image';
import {
  ShieldCheck,
  LayoutGrid,
  Files,
  AudioLines,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react';
import {
  featuredTools,
  modulesWithTools,
  MODULE_LABELS,
  MODULE_HREF,
  type ToolModule,
} from '@/lib/tools';
import { cn } from '@/lib/utils';

// Ícono de cada módulo en el footer (coherente con el switcher de la landing).
const MODULE_ICON: Record<ToolModule, LucideIcon> = {
  documentos: Files,
  medios: AudioLines,
};

/**
 * Footer de marketing sobre navy. Patrón big-tech (Stripe, Linear, Vercel): el
 * footer NO es el catálogo. Enumerar las 30+ herramientas abruma y duplica lo
 * que ya está justo arriba; en su lugar, un sitemap CURADO en dos columnas:
 *  - «Populares»: un puñado de herramientas estrella (featuredTools).
 *  - «Explorar»: el índice global (/herramientas) y la portada de cada módulo.
 * El catálogo completo se descubre por ⌘K, por el catálogo de la home o por
 * /herramientas —no aquí.
 *
 * El COLOR sigue siendo identidad: cada herramienta lleva su ícono en su tono
 * claro (accent.onDark, legible sobre navy). El resto del cromo va en blanco.
 *
 * Va PEGADO al contenido (sin margen superior ni costura blanca): el cambio
 * papel → navy ya lo separa, y un margen transparente dejaría ver el body navy
 * del overscroll como una franja extra (ver globals.css).
 */
export default function SiteFooter() {
  const year = new Date().getFullYear();
  const featured = featuredTools();
  const modules = modulesWithTools();

  // Estilo compartido de los enlaces del sitemap (herramienta o navegación).
  const linkBase =
    'group inline-flex items-center gap-2.5 text-sm font-bold transition-colors hover-fine:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-navy';
  const heading =
    'mb-4 border-b-[3px] border-white pb-2 text-xs font-bold uppercase tracking-[0.15em] text-white';

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
              Une, divide, comprime, convierte y edita tus documentos, directo
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

          {/* Sitemap curado: Populares + Explorar (NO el catálogo completo). */}
          <nav
            aria-label="Navegación del sitio"
            className="grid grid-cols-1 gap-9 sm:grid-cols-2 sm:gap-8"
          >
            {/* Populares: un atajo a las herramientas estrella. */}
            <div>
              <p className={heading}>Populares</p>
              <ul className="space-y-3">
                {featured.map((tool) => (
                  <li key={tool.slug}>
                    <Link href={tool.href} className={cn(linkBase, 'text-white/75')}>
                      <tool.Icon
                        className={cn('h-4 w-4 shrink-0', tool.accent.onDark)}
                        strokeWidth={2}
                        aria-hidden="true"
                      />
                      <span className="decoration-2 underline-offset-4 group-hover-fine:underline">
                        {tool.name}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Explorar: el índice global + la portada de cada módulo. */}
            <div>
              <p className={heading}>Explorar</p>
              <ul className="space-y-3">
                <li>
                  <Link href="/herramientas" className={cn(linkBase, 'text-white')}>
                    <LayoutGrid
                      className="h-4 w-4 shrink-0"
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                    <span className="decoration-2 underline-offset-4 group-hover-fine:underline">
                      Todas las herramientas
                    </span>
                    <ArrowRight
                      className="h-4 w-4 shrink-0 -translate-x-1 opacity-0 transition-all duration-150 ease-out group-hover-fine:translate-x-0 group-hover-fine:opacity-70"
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                  </Link>
                </li>
                {modules.map((m) => {
                  const Icon = MODULE_ICON[m];
                  return (
                    <li key={m}>
                      <Link
                        href={MODULE_HREF[m]}
                        className={cn(linkBase, 'text-white/75')}
                      >
                        <Icon
                          className="h-4 w-4 shrink-0"
                          strokeWidth={2}
                          aria-hidden="true"
                        />
                        <span className="decoration-2 underline-offset-4 group-hover-fine:underline">
                          {MODULE_LABELS[m]}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
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
