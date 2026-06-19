import AmbientMedia from '@/components/AmbientMedia';
import ToolCatalog from '@/components/landing/ToolCatalog';
import ModuleSwitcher from '@/components/landing/ModuleSwitcher';

export default function Home() {
  return (
    <div className="container mx-auto max-w-6xl py-12 pl-[max(20px,env(safe-area-inset-left))] pr-[max(20px,env(safe-area-inset-right))] sm:py-14 md:py-20">
      <section className="mb-10 motion-safe:animate-fade-in sm:mb-14">
        {/* Hero a dos columnas en pantallas medianas: el texto manda (queda a la
            izquierda y primero en el flujo), la media ambiental acompaña a la
            derecha. En móvil se apila —texto arriba— para no empujar las
            herramientas: la app sigue sintiéndose "al instante". */}
        <div className="grid items-center gap-8 md:grid-cols-[1.1fr_1fr] md:gap-12">
          <div className="max-w-xl">
            {/* Tamaño fluido (clamp) en vez de saltos por breakpoint: en Roboto
                Mono —glifos anchos— un `text-4xl` fijo desbordaba en teléfonos
                chicos. El salto de línea solo se fuerza con sitio (≥400px); por
                debajo, envuelve solo. */}
            <h1 className="text-[clamp(1.65rem,8vw,3.75rem)] font-bold leading-[1.05] tracking-tight text-ink">
              Tus documentos,
              <br className="hidden min-[400px]:block" /> resueltos al instante.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:mt-6 sm:text-lg">
              Une, divide, comprime y convierte documentos en segundos, directo
              desde tu navegador.
            </p>
          </div>
          <AmbientMedia
            src="/higgsfield/hero/hero.mp4"
            srcWebm="/higgsfield/hero/hero.webm"
            poster="/higgsfield/hero/hero.svg"
            alt="Hojas de papel dispersas que se reúnen en un documento encuadernado"
            loop={false}
          />
        </div>
      </section>

      <section>
        <ModuleSwitcher current="documentos" />
        <ToolCatalog module="documentos" />
      </section>

      {/*
       * Confianza por transparencia (no una rejilla de "features"): una sola
       * afirmación que lidera con el diferenciador real, la privacidad, y
       * absorbe el resto en prosa. La regla navy es la única estructura.
       */}
      <section className="mt-16 max-w-3xl border-t-4 border-ink pt-8 sm:mt-24 sm:pt-10">
        <h2 className="text-2xl font-bold leading-tight text-ink sm:text-3xl">
          Tus archivos nunca salen de tu equipo.
        </h2>
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
          Todo se procesa en tu navegador: nada se sube a un servidor, sin
          registros ni instalaciones. Abre una herramienta y trabaja al instante,
          en computadora, tableta o móvil.
        </p>
      </section>
    </div>
  );
}
