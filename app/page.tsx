import ToolGrid from '@/components/landing/ToolGrid';

export default function Home() {
  return (
    <div className="container mx-auto max-w-6xl px-4 py-14 md:py-20">
      <section className="mb-12 max-w-2xl motion-safe:animate-fade-in">
        <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brand-ocean shadow-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-red" />
          Herramientas GAINCO
        </p>
        <h1 className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-brand-navy sm:text-5xl md:text-6xl">
          Tus PDF y Excel,
          <br />
          <span className="text-brand-red">resueltos al instante.</span>
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
          Une, divide y comprime documentos en segundos. Sencillo, rápido y sin
          que tus archivos salgan de tu dispositivo.
        </p>
      </section>

      <section className="motion-safe:animate-slide-up">
        <ToolGrid />
      </section>

      <section className="mt-20">
        <h2 className="sr-only">Por qué usar las Herramientas GAINCO</h2>
        <dl className="grid grid-cols-1 gap-x-10 gap-y-10 sm:grid-cols-3">
          <Feature
            index="01"
            title="Privado y seguro"
            text="El procesamiento ocurre en tu navegador; tus archivos no se suben a ningún servidor."
          />
          <Feature
            index="02"
            title="Rápido y sin instalar"
            text="Sin registros ni descargas. Abre la herramienta y comienza al instante."
          />
          <Feature
            index="03"
            title="En cualquier dispositivo"
            text="Funciona en computadora, tableta y móvil con la misma experiencia."
          />
        </dl>
      </section>
    </div>
  );
}

/**
 * Bloque de característica con lenguaje de "ficha técnica": número índice en
 * display + regla superior con acento rojo de marca. Sin chip de icono pastel
 * ni iconos genéricos, para que no se lea como plantilla generada.
 */
function Feature({
  index,
  title,
  text,
}: {
  index: string;
  title: string;
  text: string;
}) {
  return (
    <div className="relative pt-5">
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-border" />
      <span aria-hidden="true" className="absolute left-0 top-0 h-px w-8 bg-brand-red" />
      <span
        aria-hidden="true"
        className="font-display text-xs font-bold tracking-[0.25em] text-brand-red"
      >
        {index}
      </span>
      <dt className="mt-3 font-display text-base font-bold text-brand-navy">
        {title}
      </dt>
      <dd className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
        {text}
      </dd>
    </div>
  );
}
