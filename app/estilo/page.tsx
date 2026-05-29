'use client';

import dynamic from 'next/dynamic';

/**
 * /estilo es documentación interna del sistema visual. El showcase usa
 * primitivos Radix (Progress, Slider, Checkbox, Select…) cuya compilación de
 * servidor en Next 13.5 rompe el "collect page data" del build (template
 * literals con backticks escapados → SyntaxError). Como no necesita SSR, lo
 * cargamos solo en cliente (ssr:false), igual que el compresor.
 */
const EstiloShowcase = dynamic(() => import('./EstiloShowcase'), {
  ssr: false,
});

export default function EstiloPage() {
  return <EstiloShowcase />;
}
