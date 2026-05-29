import Link from 'next/link';
import Image from 'next/image';
import { ShieldCheck } from 'lucide-react';
import { TOOLS } from '@/lib/tools';

export default function SiteFooter() {
  return (
    <footer className="relative mt-20 overflow-hidden bg-brand-navy text-white/80">
      {/* hairline rojo de marca arriba */}
      <span className="absolute inset-x-0 top-0 h-0.5 bg-brand-red" />
      {/* halo sutil */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-brand-ocean/20 blur-3xl"
      />

      <div className="container relative mx-auto max-w-6xl px-4 py-12">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <Image
              src="/logos/logo-gainco-white.svg"
              alt="GAINCO"
              width={150}
              height={33}
              className="h-8 w-auto"
            />
            <p className="mt-4 text-sm leading-relaxed text-white/80">
              Une, divide y comprime archivos PDF y Excel de forma rápida y
              segura, directo desde tu navegador.
            </p>
            <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/90 ring-1 ring-white/15">
              <ShieldCheck className="h-4 w-4" />
              Tus archivos se procesan en tu dispositivo
            </p>
          </div>

          <nav aria-label="Herramientas" className="md:text-right">
            <p className="mb-4 font-display text-xs font-semibold uppercase tracking-wider text-white/60">
              Herramientas
            </p>
            <ul className="space-y-2.5">
              {TOOLS.map((tool) => (
                <li key={tool.slug}>
                  <Link
                    href={tool.href}
                    className="rounded text-sm text-white/85 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red focus-visible:ring-offset-2 focus-visible:ring-offset-brand-navy"
                  >
                    {tool.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-12 border-t border-white/10 pt-6 text-center text-xs text-white/60">
          © {new Date().getFullYear()} GAINCO. Todos los derechos reservados.
        </div>
      </div>
    </footer>
  );
}
