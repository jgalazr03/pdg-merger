import {
  Combine,
  Scissors,
  Minimize2,
  Repeat,
  RotateCw,
  LayoutGrid,
  type LucideIcon,
} from 'lucide-react';

export type ToolSlug =
  | 'unir'
  | 'dividir'
  | 'comprimir'
  | 'convertir'
  | 'girar'
  | 'organizar';

/**
 * Sistema de acento.
 *
 * Cada herramienta tiene UN color propio (de una paleta armonizada de tonos
 * profundos sobre papel) que se aplica de forma CONSISTENTE en todas sus
 * superficies: el tile del ícono (relleno de color + glifo blanco + borde
 * navy), el ícono activo del nav, la línea/indicador activo y el spinner. Solo
 * el CTA (rojo de marca) y el foco (ink/navy, por invariante) son compartidos.
 *
 * Paleta de herramientas (peso -700 para pasar contraste AA con glifo blanco):
 *   unir → océano #004b7d · dividir → ámbar #b45309 · comprimir → teal #0f766e
 *   · convertir → índigo #4338ca
 * Las cajas de ayuda usan el tinte suave del MISMO matiz (ocean/amber/highlight
 * /indigo-soft, todos en el registro apagado S~45%/L~82%) con texto ink.
 *
 * Todas las clases son literales para que el JIT de Tailwind las detecte.
 */
export interface ToolAccent {
  // --- Compartido (mismo valor en las 3 herramientas) ---
  /** Anillo de foco accesible: ink (navy), por invariante. */
  ring: string;

  // --- Color propio de la herramienta (consistente en todas sus superficies) ---
  /** CTA primario: relleno con el color de la herramienta + texto blanco. */
  solid: string;
  /** Relleno del tile del ícono (con glifo blanco + borde navy). */
  iconBg: string;
  /** Mismo color como glifo/texto sobre papel: nav activo, spinner, progreso. */
  text: string;
  /** Mismo color para la línea/indicador activo. */
  line: string;
  /** Versión CLARA del color, para íconos sobre fondo oscuro (footer navy). */
  onDark: string;
  /** Fondo suave para cajas de ayuda. */
  soft: string;
  /** Texto sobre fondo suave. */
  softText: string;
}

// Compartido por las 3 herramientas: foco en ink (navy), por invariante del
// sistema. El color propio (solid/iconBg/text/line) lo aporta cada herramienta
// más abajo. El rojo se reserva SOLO para destructivo/errores (no para CTAs).
const BRAND = {
  ring: 'focus-visible:ring-ink',
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
  /** Formatos y límites, en divulgación progresiva (componente ToolConstraints). */
  constraints: string[];
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
    constraints: [
      'Formatos: PDF, JPG y PNG',
      'Se combinan en el orden que ves (puedes reordenar)',
      'Las imágenes se ajustan a tamaño Carta (recorte opcional)',
    ],
    accent: {
      ...BRAND,
      solid: 'bg-brand-ocean text-white hover:opacity-85',
      iconBg: 'bg-brand-ocean',
      text: 'text-brand-ocean',
      line: 'bg-brand-ocean',
      onDark: 'text-sky-400',
      soft: 'bg-ocean-soft',
      softText: 'text-ink',
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
    constraints: [
      'Formato: PDF (un archivo a la vez)',
      'Indica páginas o rangos, p. ej. 1-3, 5, 8-10',
      'Genera un documento por cada rango',
    ],
    accent: {
      ...BRAND,
      solid: 'bg-amber-700 text-white hover:opacity-85',
      iconBg: 'bg-amber-700',
      text: 'text-amber-700',
      line: 'bg-amber-700',
      onDark: 'text-amber-400',
      soft: 'bg-amber-soft',
      softText: 'text-ink',
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
    constraints: [
      'Formatos: PDF y Excel (.xlsx, .xls)',
      'Tamaño máximo total: 500 MB',
      'Excel: comprime imágenes embebidas sin afectar los datos',
      'Archivos grandes (más de 100 MB) pueden tardar varios minutos',
      'Sin archivos duplicados',
    ],
    accent: {
      ...BRAND,
      solid: 'bg-teal-700 text-white hover:opacity-85',
      iconBg: 'bg-teal-700',
      text: 'text-teal-700',
      line: 'bg-teal-700',
      onDark: 'text-teal-400',
      soft: 'bg-highlight-soft',
      softText: 'text-ink',
    },
  },
  {
    slug: 'convertir',
    href: '/convertir',
    name: 'Convertir',
    title: 'Convertir archivos',
    tagline: 'Convierte entre PDF e imágenes (JPG, PNG, WebP) en tu navegador.',
    description:
      'Convierte archivos entre PDF e imágenes: pasa un PDF a imágenes (una por página), una imagen a PDF, o entre formatos de imagen (JPG, PNG, WebP). Todo ocurre en tu navegador.',
    Icon: Repeat,
    constraints: [
      'Entrada: PDF, JPG, PNG, WebP, GIF, BMP, SVG y AVIF',
      'Salida: JPG, PNG, WebP y PDF',
      'PDF → imágenes: una imagen por página',
      'Imágenes → PDF: un PDF por imagen (para combinar varias, usa Unir)',
      'No soporta Office (Word/Excel), TIFF ni HEIC: no se pueden procesar en el navegador',
    ],
    accent: {
      ...BRAND,
      solid: 'bg-indigo-700 text-white hover:opacity-85',
      iconBg: 'bg-indigo-700',
      text: 'text-indigo-700',
      line: 'bg-indigo-700',
      onDark: 'text-indigo-400',
      soft: 'bg-indigo-soft',
      softText: 'text-ink',
    },
  },
  {
    slug: 'girar',
    href: '/girar',
    name: 'Girar PDF',
    title: 'Girar PDF',
    tagline: 'Rota las páginas de un PDF y guárdalo sin perder calidad.',
    description:
      'Gira las páginas de un PDF 90° o 180°, todas a la vez o una por una, y descárgalo sin perder calidad. Todo ocurre en tu navegador.',
    Icon: RotateCw,
    constraints: [
      'Formato: PDF (un archivo a la vez)',
      'Gira todas las páginas o cada una por separado',
      'Sin pérdida de calidad: no se rasteriza el contenido',
      'Vista previa de cada página para girar con precisión',
    ],
    accent: {
      ...BRAND,
      solid: 'bg-fuchsia-700 text-white hover:opacity-85',
      iconBg: 'bg-fuchsia-700',
      text: 'text-fuchsia-700',
      line: 'bg-fuchsia-700',
      onDark: 'text-fuchsia-400',
      soft: 'bg-fuchsia-soft',
      softText: 'text-ink',
    },
  },
  {
    slug: 'organizar',
    href: '/organizar',
    name: 'Organizar PDF',
    title: 'Organizar PDF',
    tagline: 'Reordena, gira y elimina páginas de un PDF, y guárdalo.',
    description:
      'Reordena las páginas de un PDF arrastrándolas, gíralas o elimínalas, y descarga el documento reorganizado sin perder calidad. Todo ocurre en tu navegador.',
    Icon: LayoutGrid,
    constraints: [
      'Formato: PDF (un archivo a la vez)',
      'Reordena arrastrando o con los botones de mover',
      'Gira o elimina páginas una por una',
      'Sin pérdida de calidad: no se rasteriza el contenido',
    ],
    accent: {
      ...BRAND,
      solid: 'bg-violet-700 text-white hover:opacity-85',
      iconBg: 'bg-violet-700',
      text: 'text-violet-700',
      line: 'bg-violet-700',
      onDark: 'text-violet-400',
      soft: 'bg-violet-soft',
      softText: 'text-ink',
    },
  },
];

export const getTool = (slug: ToolSlug): ToolDef =>
  TOOLS.find((t) => t.slug === slug)!;
