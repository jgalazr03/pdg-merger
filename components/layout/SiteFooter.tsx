import Link from 'next/link';
import Image from 'next/image';
import { ShieldCheck } from 'lucide-react';
import { TOOLS } from '@/lib/tools';
import { cn } from '@/lib/utils';

/**
 * Footer sobre navy de marca. En el footer el COLOR = identidad de herramienta:
 * cada enlace lleva su ícono en el tono claro de su herramienta (accent.onDark,
 * legible sobre navy). Todo lo demás (chrome) va neutro en blanco —escudo,
 * eyebrow y la costura superior (que espeja el border-b-4 del header)— para no
 * competir con los colores de herramienta. La privacidad se afirma como
 * propuesta de valor, no como "badge".
 */
export default function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-20 border-t-4 border-white bg-brand-navy pb-[env(safe-area-inset-bottom)] text-white/80">
      <div className="container mx-auto max-w-6xl py-14 pl-[max(20px,env(safe-area-inset-left))] pr-[max(20px,env(safe-area-inset-right))]">
        <div className="grid gap-10 md:grid-cols-[1fr_auto] md:gap-16">
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
              Une, divide, comprime y convierte archivos PDF y Excel, directo
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

          {/* Herramientas */}
          <nav aria-label="Herramientas" className="md:min-w-[180px]">
            <p className="mb-5 text-xs font-bold uppercase tracking-wider text-white/50">
              Herramientas
            </p>
            <ul className="space-y-3.5">
              {TOOLS.map((tool) => (
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
