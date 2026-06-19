import type { Metadata } from 'next';
import { TOOLS } from '@/lib/tools';
import ToolCatalog from '@/components/landing/ToolCatalog';

export const metadata: Metadata = {
  title: 'Todas las herramientas',
  description:
    'Explora todas las herramientas de GAINCO para PDF, Excel y medios: unir, dividir, comprimir, convertir, OCR, transcribir y más. Todo ocurre en tu navegador.',
};

/**
 * Índice global del catálogo: el destino canónico «todas las herramientas»
 * (footer, header y ⌘K llevan aquí). Reusa el lanzador `ToolCatalog` SIN módulo
 * —buscador + filtros de categoría + tarjetas sobre `lib/tools.ts`—, así que
 * lista el catálogo completo (todos los módulos) en una sola página navegable.
 * Patrón big-tech (iLovePDF, Adobe, Smallpdf): una página de catálogo dedicada,
 * no un footer-muro.
 */
export default function HerramientasPage() {
  return (
    <div className="container mx-auto max-w-6xl py-12 pl-[max(20px,env(safe-area-inset-left))] pr-[max(20px,env(safe-area-inset-right))] sm:py-14 md:py-20">
      <section className="mb-10 max-w-3xl motion-safe:animate-fade-in sm:mb-14">
        <h1 className="text-[clamp(1.65rem,8vw,3.75rem)] font-bold leading-[1.05] tracking-tight text-ink">
          Todas las herramientas.
        </h1>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:mt-6 sm:text-lg">
          Busca, filtra y abre cualquiera de las {TOOLS.length} herramientas de
          GAINCO. Todo ocurre en tu navegador.
        </p>
      </section>

      <section>
        <ToolCatalog />
      </section>
    </div>
  );
}
