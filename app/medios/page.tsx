import type { Metadata } from 'next';
import ToolCatalog from '@/components/landing/ToolCatalog';
import ModuleSwitcher from '@/components/landing/ModuleSwitcher';

export const metadata: Metadata = {
  title: 'Medios — audio y video',
  description:
    'Transcribe audio y video a texto en español, directo desde tu navegador. Tus grabaciones no salen de tu equipo.',
};

export default function MediosPage() {
  return (
    <div className="container mx-auto max-w-6xl py-12 pl-[max(20px,env(safe-area-inset-left))] pr-[max(20px,env(safe-area-inset-right))] sm:py-14 md:py-20">
      <section className="mb-10 max-w-3xl motion-safe:animate-fade-in sm:mb-14">
        <h1 className="text-[clamp(1.65rem,8vw,3.75rem)] font-bold leading-[1.05] tracking-tight text-ink">
          Tus grabaciones,
          <br className="hidden min-[400px]:block" /> convertidas en texto.
        </h1>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:mt-6 sm:text-lg">
          Transcribe audio y video a texto en español, directo desde tu
          navegador.
        </p>
      </section>

      <section>
        <ModuleSwitcher current="medios" />
        <ToolCatalog module="medios" />
      </section>

      {/* Misma promesa de privacidad: por defecto, la grabación se procesa en el
          propio equipo. */}
      <section className="mt-16 max-w-3xl border-t-4 border-ink pt-8 sm:mt-24 sm:pt-10">
        <h2 className="text-2xl font-bold leading-tight text-ink sm:text-3xl">
          Tus grabaciones nunca salen de tu equipo.
        </h2>
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
          La transcripción se procesa en tu navegador: nada se sube a un
          servidor, sin registros ni instalaciones. Abre la herramienta y trabaja
          al instante, en computadora, tableta o móvil.
        </p>
      </section>
    </div>
  );
}
