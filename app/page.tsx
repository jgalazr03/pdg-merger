import { ShieldCheck, Zap, MonitorSmartphone } from 'lucide-react';
import ToolGrid from '@/components/landing/ToolGrid';

export default function Home() {
  return (
    <div className="container mx-auto max-w-6xl px-4 py-12 md:py-16">
      <section className="mx-auto mb-12 max-w-2xl text-center motion-safe:animate-fade-in">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl md:text-5xl">
          Herramientas para tus PDF y Excel
        </h1>
        <p className="mt-4 text-lg text-gray-600">
          Une, divide y comprime tus documentos en segundos. Sencillo, rápido y
          sin que tus archivos salgan de tu dispositivo.
        </p>
      </section>

      <section className="motion-safe:animate-slide-up">
        <ToolGrid />
      </section>

      <section className="mt-14 grid grid-cols-1 gap-6 border-t border-gray-200 pt-10 sm:grid-cols-3">
        <Feature
          Icon={ShieldCheck}
          title="Privado y seguro"
          text="El procesamiento ocurre en tu navegador; tus archivos no se suben a ningún servidor."
        />
        <Feature
          Icon={Zap}
          title="Rápido y sin instalar"
          text="Sin registros ni descargas. Abre la herramienta y comienza al instante."
        />
        <Feature
          Icon={MonitorSmartphone}
          title="En cualquier dispositivo"
          text="Funciona en computadora, tableta y móvil con la misma experiencia."
        />
      </section>
    </div>
  );
}

function Feature({
  Icon,
  title,
  text,
}: {
  Icon: typeof ShieldCheck;
  title: string;
  text: string;
}) {
  return (
    <div className="text-center sm:text-left">
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
        <Icon className="h-5 w-5 text-gray-700" />
      </div>
      <h3 className="mt-3 text-sm font-semibold text-gray-900">{title}</h3>
      <p className="mt-1 text-sm text-gray-600">{text}</p>
    </div>
  );
}
