import { Combine, Scissors, Minimize2, type LucideIcon } from 'lucide-react';

export type ToolSlug = 'unir' | 'dividir' | 'comprimir';

/**
 * Sistema de acento.
 *
 * Filosofía de marca GAINCO: el CHROME de acción es compartido (rojo de marca
 * para CTAs, navy para la estructura, foco rojo). Cada herramienta solo aporta
 * un SUB-ACENTO sutil (su tono) en el glifo del ícono, una línea fina y los
 * tintes suaves de las cajas informativas. Así se siente UN producto con
 * identidad, no tres apps de colores distintos.
 *
 * Todas las clases son literales para que el JIT de Tailwind las detecte.
 */
export interface ToolAccent {
  // --- Chrome de marca (mismo valor en las 3 herramientas) ---
  /** CTA primario: rojo de marca. */
  solid: string;
  /** Anillo de foco accesible: rojo de marca. */
  ring: string;
  /** Tile del ícono en el hero: navy de marca. */
  iconBg: string;

  // --- Sub-acento por herramienta (sutil) ---
  /** Tono de la herramienta para el glifo del ícono y acentos pequeños. */
  text: string;
  /** Línea/borde fino con el tono de la herramienta. */
  line: string;
  /** Fondo suave para cajas de ayuda. */
  soft: string;
  /** Texto sobre fondo suave. */
  softText: string;
}

// Chrome de marca compartido
const BRAND = {
  solid: 'bg-brand-red text-white hover:bg-brand-red/90',
  ring: 'focus-visible:ring-brand-red',
  iconBg: 'bg-brand-navy',
};

export interface ToolDef {
  slug: ToolSlug;
  href: string;
  /** Nombre corto para navegación. */
  name: string;
  /** Título de la página (H1). */
  title: string;
  /** Descripción breve para tarjetas/hero. */
  tagline: string;
  /** Descripción larga (landing/SEO). */
  description: string;
  Icon: LucideIcon;
  accent: ToolAccent;
}

export const TOOLS: ToolDef[] = [
  {
    slug: 'unir',
    href: '/unir',
    name: 'Unir PDF',
    title: 'Unir PDFs e imágenes',
    tagline: 'Combina varios PDFs e imágenes (JPG, PNG) en un solo documento.',
    description:
      'Combina archivos PDF e imágenes en un único PDF, reordénalos a tu gusto y descárgalo al instante. Todo ocurre en tu navegador.',
    Icon: Combine,
    accent: {
      ...BRAND,
      text: 'text-brand-ocean',
      line: 'bg-brand-ocean',
      soft: 'bg-sky-50',
      softText: 'text-brand-ocean',
    },
  },
  {
    slug: 'dividir',
    href: '/dividir',
    name: 'Dividir PDF',
    title: 'Dividir PDF',
    tagline: 'Extrae páginas o rangos de un PDF en documentos independientes.',
    description:
      'Separa un PDF en varios documentos indicando páginas o rangos (1-3, 5, 8-10). Rápido, preciso y 100% en tu navegador.',
    Icon: Scissors,
    accent: {
      ...BRAND,
      text: 'text-amber-600',
      line: 'bg-amber-500',
      soft: 'bg-amber-50',
      softText: 'text-amber-700',
    },
  },
  {
    slug: 'comprimir',
    href: '/comprimir',
    name: 'Comprimir',
    title: 'Comprimir PDFs y Excel',
    tagline: 'Reduce el peso de archivos PDF y Excel manteniendo la calidad.',
    description:
      'Disminuye el tamaño de tus PDFs y hojas de Excel comprimiendo imágenes sin afectar los datos. Ideal para enviar por correo.',
    Icon: Minimize2,
    accent: {
      ...BRAND,
      text: 'text-teal-700',
      line: 'bg-teal-500',
      soft: 'bg-teal-50',
      softText: 'text-teal-700',
    },
  },
];

export const getTool = (slug: ToolSlug): ToolDef =>
  TOOLS.find((t) => t.slug === slug)!;
