import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { TOOLS } from '@/lib/tools';

export default function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-gray-200 bg-white">
      <div className="container mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <p className="text-base font-bold text-gray-900">
              Herramientas <span className="text-gray-500">GAINCO</span>
            </p>
            <p className="mt-2 text-sm text-gray-600">
              Une, divide y comprime archivos PDF y Excel de forma rápida y
              segura, directo desde tu navegador.
            </p>
            <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
              <ShieldCheck className="h-4 w-4" />
              Tus archivos se procesan en tu dispositivo
            </p>
          </div>

          <nav aria-label="Herramientas" className="md:text-right">
            <p className="mb-3 text-sm font-semibold text-gray-900">
              Herramientas
            </p>
            <ul className="space-y-2">
              {TOOLS.map((tool) => (
                <li key={tool.slug}>
                  <Link
                    href={tool.href}
                    className="rounded text-sm text-gray-600 transition-colors hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2"
                  >
                    {tool.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-10 border-t border-gray-100 pt-6 text-center text-xs text-gray-500">
          © {new Date().getFullYear()} GAINCO. Todos los derechos reservados.
        </div>
      </div>
    </footer>
  );
}
