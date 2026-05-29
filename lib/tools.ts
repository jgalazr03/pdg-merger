import { Combine, Scissors, Minimize2, type LucideIcon } from 'lucide-react';

export type ToolSlug = 'unir' | 'dividir' | 'comprimir';

/**
 * Conjunto de clases Tailwind (literales, para que el JIT las detecte) que
 * definen el color de acento de cada herramienta. Centralizar aquí evita
 * colores "mágicos" repartidos por los componentes.
 */
export interface ToolAccent {
  /** Color del texto/ícono de acento. */
  text: string;
  /** Botón sólido principal. */
  solid: string;
  /** Fondo suave (cajas informativas, estados activos). */
  soft: string;
  /** Texto sobre fondo suave. */
  softText: string;
  /** Fondo del círculo del ícono en el hero. */
  iconBg: string;
  /** Borde en estado activo/seleccionado. */
  border: string;
  /** Borde al hacer hover en la zona de carga. */
  borderHover: string;
  /** Anillo de foco accesible. */
  ring: string;
  /** Gradiente de fondo para la tarjeta de la landing. */
  cardGradient: string;
}

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
      text: 'text-blue-600',
      solid: 'bg-blue-600 hover:bg-blue-700 text-white',
      soft: 'bg-blue-50',
      softText: 'text-blue-800',
      iconBg: 'bg-blue-100',
      border: 'border-blue-500',
      borderHover: 'hover:border-blue-400',
      ring: 'focus-visible:ring-blue-500',
      cardGradient: 'from-blue-50',
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
      text: 'text-orange-600',
      solid: 'bg-orange-600 hover:bg-orange-700 text-white',
      soft: 'bg-orange-50',
      softText: 'text-orange-800',
      iconBg: 'bg-orange-100',
      border: 'border-orange-500',
      borderHover: 'hover:border-orange-400',
      ring: 'focus-visible:ring-orange-500',
      cardGradient: 'from-orange-50',
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
      text: 'text-purple-600',
      solid: 'bg-purple-600 hover:bg-purple-700 text-white',
      soft: 'bg-purple-50',
      softText: 'text-purple-800',
      iconBg: 'bg-purple-100',
      border: 'border-purple-500',
      borderHover: 'hover:border-purple-400',
      ring: 'focus-visible:ring-purple-500',
      cardGradient: 'from-purple-50',
    },
  },
];

export const getTool = (slug: ToolSlug): ToolDef =>
  TOOLS.find((t) => t.slug === slug)!;
