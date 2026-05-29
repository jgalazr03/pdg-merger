import ToolGrid from '@/components/landing/ToolGrid';

export default function Home() {
  return (
    <div className="container mx-auto max-w-6xl px-4 py-14 md:py-20">
      <section className="mb-14 max-w-3xl motion-safe:animate-fade-in">
        <h1 className="text-4xl font-bold leading-[1.04] tracking-tight text-ink sm:text-5xl md:text-6xl">
          Tus PDF y Excel,
          <br />
          resueltos al instante.
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
          Une, divide y comprime documentos en segundos, directo desde tu
          navegador.
        </p>
      </section>

      <section className="motion-safe:animate-slide-up">
        <ToolGrid />
      </section>

      {/*
       * Confianza por transparencia (no una rejilla de "features"): una sola
       * afirmación que lidera con el diferenciador real, la privacidad, y
       * absorbe el resto en prosa. La regla navy es la única estructura.
       */}
      <section className="mt-24 max-w-3xl border-t-4 border-ink pt-10">
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
