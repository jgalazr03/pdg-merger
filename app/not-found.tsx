import type { Metadata } from 'next';
import ToolCatalog from '@/components/landing/ToolCatalog';

export const metadata: Metadata = {
  title: 'Página no encontrada',
};

/**
 * 404 con salida: en vez del "no encontrado" genérico de Next, ofrece el
 * mismo buscador de /herramientas (`ToolCatalog` sin `module` = catálogo
 * completo) para que un enlace viejo o mal escrito no sea un callejón sin
 * salida. Mismo padding que `ToolShell` para que se sienta parte del sitio.
 */
export default function NotFound() {
  return (
    <div className="container mx-auto max-w-6xl py-5 pl-[max(20px,env(safe-area-inset-left))] pr-[max(20px,env(safe-area-inset-right))] sm:py-8 md:py-16">
      <section className="mb-8 max-w-3xl motion-safe:animate-fade-in sm:mb-12">
        <h1 className="text-[clamp(1.65rem,8vw,3.75rem)] font-bold leading-[1.05] tracking-tight text-ink">
          Esa página no existe
        </h1>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:mt-6 sm:text-lg">
          Puede que el enlace sea viejo o venga de otra herramienta. Busca lo
          que necesitas:
        </p>
      </section>

      <section>
        <ToolCatalog />
      </section>
    </div>
  );
}
