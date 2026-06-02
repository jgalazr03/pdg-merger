import {
  Combine,
  Scissors,
  Minimize2,
  Repeat,
  RotateCw,
  LayoutGrid,
  FileOutput,
  Shuffle,
  Droplets,
  Hash,
  Heading,
  Stamp,
  PenTool,
  Crop,
  Scaling,
  Columns2,
  FilePlus,
  Tags,
  BookOpen,
  Contrast,
  Info,
  Type,
  FileText,
  Table,
  Eraser,
  Layers,
  Lock,
  type LucideIcon,
} from 'lucide-react';

export type ToolSlug =
  | 'unir'
  | 'dividir'
  | 'comprimir'
  | 'convertir'
  | 'girar'
  | 'organizar'
  | 'extraer-paginas'
  | 'unir-alternado'
  | 'marca-de-agua'
  | 'numerar-paginas'
  | 'encabezado-pie'
  | 'sello-imagen'
  | 'firmar-pdf'
  | 'recortar-pdf'
  | 'redimensionar-pdf'
  | 'nup-pdf'
  | 'paginas-en-blanco'
  | 'metadatos-pdf'
  | 'portada-pdf'
  | 'escala-grises'
  | 'info-pdf'
  | 'texto-a-pdf'
  | 'extraer-texto'
  | 'csv-a-pdf'
  | 'limpiar-metadatos'
  | 'aplanar-pdf'
  | 'contrasena-pdf';

/** Categorías del catálogo (agrupan herramientas en nav, landing y footer). */
export type ToolCategory =
  | 'organizar'
  | 'editar'
  | 'optimizar'
  | 'convertir'
  | 'seguridad';

/**
 * Sistema de acento.
 *
 * Cada herramienta tiene UN color propio (de una paleta armonizada de tonos
 * profundos sobre papel) que se aplica de forma CONSISTENTE en todas sus
 * superficies: el tile del ícono (relleno de color + glifo blanco + borde
 * navy), el ícono activo del nav, la línea/indicador activo y el spinner. Solo
 * el CTA y el foco (ink/navy, por invariante) son compartidos.
 *
 * Con el catálogo ampliado los tonos se REUTILIZAN entre categorías distintas
 * (no hay 25 matices legibles): el orden de la rejilla evita que dos vecinos
 * compartan color. Cada matiz vive UNA sola vez en `TONES` con clases LITERALES
 * para que el JIT de Tailwind las detecte (nunca construidas con plantillas).
 */
export interface ToolAccent {
  // --- Compartido ---
  /** Anillo de foco accesible: ink (navy), por invariante. */
  ring: string;

  // --- Color propio de la herramienta (consistente en todas sus superficies) ---
  /** CTA primario: relleno con el color de la herramienta + texto blanco. */
  solid: string;
  /** Relleno del tile del ícono (con glifo blanco + borde navy). */
  iconBg: string;
  /** Mismo color como glifo/texto sobre papel: nav activo, spinner, progreso. */
  text: string;
  /** Variante group-hover del color del ícono: lo colorea al pasar el cursor en
   *  menús (clase literal para el JIT de Tailwind). */
  iconHover: string;
  /** Mismo color para la línea/indicador activo. */
  line: string;
  /** Versión CLARA del color, para íconos sobre fondo oscuro (footer navy). */
  onDark: string;
  /** Fondo suave para cajas de ayuda. */
  soft: string;
  /** Texto sobre fondo suave. */
  softText: string;
}

// Compartido por todas las herramientas: foco en ink (navy), por invariante del
// sistema. El color propio (solid/iconBg/text/line) lo aporta cada matiz abajo.
const BRAND = {
  ring: 'focus-visible:ring-ink',
};

/**
 * Catálogo de matices reutilizables. Clases LITERALES (el JIT de Tailwind las
 * escanea como strings estáticos). `ocean` y `teal` usan tokens de marca
 * propios (brand-ocean / highlight-soft); el resto, la paleta Tailwind a peso
 * -700 (glifo blanco AA) con su token pastel `--<tono>-soft`.
 */
export const TONES = {
  ocean: {
    ...BRAND,
    solid: 'bg-brand-ocean text-white hover:opacity-85',
    iconBg: 'bg-brand-ocean',
    text: 'text-brand-ocean',
    iconHover: 'group-hover:text-brand-ocean',
    line: 'bg-brand-ocean',
    onDark: 'text-sky-400',
    soft: 'bg-ocean-soft',
    softText: 'text-ink',
  },
  amber: {
    ...BRAND,
    solid: 'bg-amber-700 text-white hover:opacity-85',
    iconBg: 'bg-amber-700',
    text: 'text-amber-700',
    iconHover: 'group-hover:text-amber-700',
    line: 'bg-amber-700',
    onDark: 'text-amber-400',
    soft: 'bg-amber-soft',
    softText: 'text-ink',
  },
  teal: {
    ...BRAND,
    solid: 'bg-teal-700 text-white hover:opacity-85',
    iconBg: 'bg-teal-700',
    text: 'text-teal-700',
    iconHover: 'group-hover:text-teal-700',
    line: 'bg-teal-700',
    onDark: 'text-teal-400',
    soft: 'bg-highlight-soft',
    softText: 'text-ink',
  },
  indigo: {
    ...BRAND,
    solid: 'bg-indigo-700 text-white hover:opacity-85',
    iconBg: 'bg-indigo-700',
    text: 'text-indigo-700',
    iconHover: 'group-hover:text-indigo-700',
    line: 'bg-indigo-700',
    onDark: 'text-indigo-400',
    soft: 'bg-indigo-soft',
    softText: 'text-ink',
  },
  fuchsia: {
    ...BRAND,
    solid: 'bg-fuchsia-700 text-white hover:opacity-85',
    iconBg: 'bg-fuchsia-700',
    text: 'text-fuchsia-700',
    iconHover: 'group-hover:text-fuchsia-700',
    line: 'bg-fuchsia-700',
    onDark: 'text-fuchsia-400',
    soft: 'bg-fuchsia-soft',
    softText: 'text-ink',
  },
  violet: {
    ...BRAND,
    solid: 'bg-violet-700 text-white hover:opacity-85',
    iconBg: 'bg-violet-700',
    text: 'text-violet-700',
    iconHover: 'group-hover:text-violet-700',
    line: 'bg-violet-700',
    onDark: 'text-violet-400',
    soft: 'bg-violet-soft',
    softText: 'text-ink',
  },
  sky: {
    ...BRAND,
    solid: 'bg-sky-700 text-white hover:opacity-85',
    iconBg: 'bg-sky-700',
    text: 'text-sky-700',
    iconHover: 'group-hover:text-sky-700',
    line: 'bg-sky-700',
    onDark: 'text-sky-400',
    soft: 'bg-sky-soft',
    softText: 'text-ink',
  },
  cyan: {
    ...BRAND,
    solid: 'bg-cyan-700 text-white hover:opacity-85',
    iconBg: 'bg-cyan-700',
    text: 'text-cyan-700',
    iconHover: 'group-hover:text-cyan-700',
    line: 'bg-cyan-700',
    onDark: 'text-cyan-400',
    soft: 'bg-cyan-soft',
    softText: 'text-ink',
  },
  blue: {
    ...BRAND,
    solid: 'bg-blue-700 text-white hover:opacity-85',
    iconBg: 'bg-blue-700',
    text: 'text-blue-700',
    iconHover: 'group-hover:text-blue-700',
    line: 'bg-blue-700',
    onDark: 'text-blue-400',
    soft: 'bg-blue-soft',
    softText: 'text-ink',
  },
  emerald: {
    ...BRAND,
    solid: 'bg-emerald-700 text-white hover:opacity-85',
    iconBg: 'bg-emerald-700',
    text: 'text-emerald-700',
    iconHover: 'group-hover:text-emerald-700',
    line: 'bg-emerald-700',
    onDark: 'text-emerald-400',
    soft: 'bg-emerald-soft',
    softText: 'text-ink',
  },
  green: {
    ...BRAND,
    solid: 'bg-green-700 text-white hover:opacity-85',
    iconBg: 'bg-green-700',
    text: 'text-green-700',
    iconHover: 'group-hover:text-green-700',
    line: 'bg-green-700',
    onDark: 'text-green-400',
    soft: 'bg-green-soft',
    softText: 'text-ink',
  },
  orange: {
    ...BRAND,
    solid: 'bg-orange-700 text-white hover:opacity-85',
    iconBg: 'bg-orange-700',
    text: 'text-orange-700',
    iconHover: 'group-hover:text-orange-700',
    line: 'bg-orange-700',
    onDark: 'text-orange-400',
    soft: 'bg-orange-soft',
    softText: 'text-ink',
  },
  rose: {
    ...BRAND,
    solid: 'bg-rose-700 text-white hover:opacity-85',
    iconBg: 'bg-rose-700',
    text: 'text-rose-700',
    iconHover: 'group-hover:text-rose-700',
    line: 'bg-rose-700',
    onDark: 'text-rose-400',
    soft: 'bg-rose-soft',
    softText: 'text-ink',
  },
  purple: {
    ...BRAND,
    solid: 'bg-purple-700 text-white hover:opacity-85',
    iconBg: 'bg-purple-700',
    text: 'text-purple-700',
    iconHover: 'group-hover:text-purple-700',
    line: 'bg-purple-700',
    onDark: 'text-purple-400',
    soft: 'bg-purple-soft',
    softText: 'text-ink',
  },
  pink: {
    ...BRAND,
    solid: 'bg-pink-700 text-white hover:opacity-85',
    iconBg: 'bg-pink-700',
    text: 'text-pink-700',
    iconHover: 'group-hover:text-pink-700',
    line: 'bg-pink-700',
    onDark: 'text-pink-400',
    soft: 'bg-pink-soft',
    softText: 'text-ink',
  },
  slate: {
    ...BRAND,
    solid: 'bg-slate-700 text-white hover:opacity-85',
    iconBg: 'bg-slate-700',
    text: 'text-slate-700',
    iconHover: 'group-hover:text-slate-700',
    line: 'bg-slate-700',
    onDark: 'text-slate-400',
    soft: 'bg-slate-soft',
    softText: 'text-ink',
  },
} satisfies Record<string, ToolAccent>;

export interface ToolDef {
  slug: ToolSlug;
  href: string;
  /** Categoría para agrupar en nav / landing / footer. */
  category: ToolCategory;
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
    category: 'organizar',
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
    accent: TONES.ocean,
  },
  {
    slug: 'dividir',
    href: '/dividir',
    category: 'organizar',
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
    accent: TONES.amber,
  },
  {
    slug: 'comprimir',
    href: '/comprimir',
    category: 'optimizar',
    name: 'Comprimir PDF',
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
    accent: TONES.teal,
  },
  {
    slug: 'convertir',
    href: '/convertir',
    category: 'convertir',
    name: 'Convertir archivos',
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
    accent: TONES.indigo,
  },
  {
    slug: 'girar',
    href: '/girar',
    category: 'editar',
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
    accent: TONES.fuchsia,
  },
  {
    slug: 'organizar',
    href: '/organizar',
    category: 'organizar',
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
    accent: TONES.violet,
  },

  // ---- Catálogo ampliado ----------------------------------------------------

  {
    slug: 'extraer-paginas',
    href: '/extraer-paginas',
    category: 'organizar',
    name: 'Extraer páginas',
    title: 'Extraer páginas de un PDF',
    tagline: 'Crea un PDF nuevo solo con las páginas que elijas.',
    description:
      'Selecciona las páginas que quieres conservar (1-3, 5, 8-10) y obtén un PDF nuevo solo con ellas, en el orden indicado. Todo ocurre en tu navegador.',
    Icon: FileOutput,
    constraints: [
      'Formato: PDF (un archivo a la vez)',
      'Indica páginas o rangos, p. ej. 1-3, 5, 8-10',
      'Las páginas se conservan en el orden indicado',
    ],
    accent: TONES.sky,
  },
  {
    slug: 'unir-alternado',
    href: '/unir-alternado',
    category: 'organizar',
    name: 'Intercalar PDF',
    title: 'Unir PDFs alternando páginas',
    tagline: 'Intercala dos PDFs página a página (A1, B1, A2, B2…).',
    description:
      'Combina dos PDFs intercalando sus páginas, ideal para juntar anverso y reverso escaneados por separado. Todo ocurre en tu navegador.',
    Icon: Shuffle,
    constraints: [
      'Formato: dos archivos PDF',
      'Las páginas se intercalan: A1, B1, A2, B2…',
      'Si un PDF tiene más páginas, las restantes van al final',
    ],
    accent: TONES.cyan,
  },
  {
    slug: 'marca-de-agua',
    href: '/marca-de-agua',
    category: 'editar',
    name: 'Añadir marca de agua',
    title: 'Añadir marca de agua',
    tagline: 'Estampa un texto en diagonal sobre todas las páginas.',
    description:
      'Añade una marca de agua de texto (CONFIDENCIAL, BORRADOR, tu nombre…) con opacidad, rotación y color ajustables, sobre todas o algunas páginas. Todo ocurre en tu navegador.',
    Icon: Droplets,
    constraints: [
      'Formato: PDF (un archivo a la vez)',
      'Marca de agua de texto con opacidad y rotación ajustables',
      'Se aplica a todas las páginas o a un rango',
    ],
    accent: TONES.blue,
  },
  {
    slug: 'numerar-paginas',
    href: '/numerar-paginas',
    category: 'editar',
    name: 'Numerar páginas',
    title: 'Numerar páginas de un PDF',
    tagline: 'Añade números de página con posición y formato a tu elección.',
    description:
      'Inserta números de página en el PDF, eligiendo posición, formato (1, 1/20, Página 1) y desde qué página empezar. Todo ocurre en tu navegador.',
    Icon: Hash,
    constraints: [
      'Formato: PDF (un archivo a la vez)',
      'Posición y formato del número configurables',
      'Puedes empezar a numerar desde la página que quieras',
    ],
    accent: TONES.emerald,
  },
  {
    slug: 'encabezado-pie',
    href: '/encabezado-pie',
    category: 'editar',
    name: 'Añadir encabezado y pie',
    title: 'Encabezado y pie de página',
    tagline: 'Agrega texto en la cabecera y el pie de cada página.',
    description:
      'Añade texto de encabezado y pie con alineación izquierda, centro o derecha, con soporte para {pagina} y {total}. Todo ocurre en tu navegador.',
    Icon: Heading,
    constraints: [
      'Formato: PDF (un archivo a la vez)',
      'Encabezado y/o pie con alineación configurable',
      'Comodines disponibles: {pagina} y {total}',
    ],
    accent: TONES.orange,
  },
  {
    slug: 'sello-imagen',
    href: '/sello-imagen',
    category: 'editar',
    name: 'Añadir sello',
    title: 'Estampar imagen o logo',
    tagline: 'Coloca una imagen (PNG/JPG) o logo sobre las páginas.',
    description:
      'Sube una imagen o logo y estámpalo en la posición, tamaño y opacidad que quieras, sobre todas o algunas páginas. Todo ocurre en tu navegador.',
    Icon: Stamp,
    constraints: [
      'Entrada: un PDF y una imagen (PNG o JPG)',
      'Posición, tamaño y opacidad configurables',
      'Se aplica a todas las páginas o a un rango',
    ],
    accent: TONES.rose,
  },
  {
    slug: 'firmar-pdf',
    href: '/firmar-pdf',
    category: 'editar',
    name: 'Firmar PDF',
    title: 'Firmar un PDF',
    tagline: 'Dibuja tu firma y colócala en la página que quieras.',
    description:
      'Dibuja tu firma con el dedo o el ratón (o sube una imagen de firma) y colócala en la posición y página que elijas. Todo ocurre en tu navegador.',
    Icon: PenTool,
    constraints: [
      'Formato: PDF (un archivo a la vez)',
      'Dibuja la firma o sube una imagen con fondo transparente',
      'Coloca la firma en la página y posición que prefieras',
    ],
    accent: TONES.purple,
  },
  {
    slug: 'recortar-pdf',
    href: '/recortar-pdf',
    category: 'editar',
    name: 'Recortar PDF',
    title: 'Recortar márgenes de un PDF',
    tagline: 'Ajusta los márgenes recortando el área visible de las páginas.',
    description:
      'Recorta los márgenes de las páginas indicando cuánto quitar por cada lado, sin rasterizar el contenido. Todo ocurre en tu navegador.',
    Icon: Crop,
    constraints: [
      'Formato: PDF (un archivo a la vez)',
      'Recorte por lado (superior, inferior, izquierda, derecha)',
      'Sin pérdida de calidad: ajusta el área visible, no rasteriza',
    ],
    accent: TONES.green,
  },
  {
    slug: 'redimensionar-pdf',
    href: '/redimensionar-pdf',
    category: 'editar',
    name: 'Redimensionar PDF',
    title: 'Redimensionar páginas de un PDF',
    tagline: 'Cambia el tamaño de página a A4, Carta, Oficio o un porcentaje.',
    description:
      'Escala las páginas de un PDF a un tamaño estándar (A4, Carta, Oficio) o a un porcentaje, manteniendo la proporción del contenido. Todo ocurre en tu navegador.',
    Icon: Scaling,
    constraints: [
      'Formato: PDF (un archivo a la vez)',
      'Tamaños: A4, Carta, Oficio o porcentaje',
      'El contenido se escala manteniendo la proporción',
    ],
    accent: TONES.cyan,
  },
  {
    slug: 'nup-pdf',
    href: '/nup-pdf',
    category: 'editar',
    name: 'Páginas por hoja',
    title: 'Varias páginas por hoja',
    tagline: 'Combina 2 o 4 páginas en una sola hoja (imposición).',
    description:
      'Coloca 2 o 4 páginas del PDF en cada hoja, ideal para imprimir cuadernillos o ahorrar papel. Todo ocurre en tu navegador.',
    Icon: Columns2,
    constraints: [
      'Formato: PDF (un archivo a la vez)',
      'Disposición: 2 o 4 páginas por hoja',
      'Sin pérdida de calidad: no se rasteriza el contenido',
    ],
    accent: TONES.blue,
  },
  {
    slug: 'paginas-en-blanco',
    href: '/paginas-en-blanco',
    category: 'editar',
    name: 'Insertar páginas en blanco',
    title: 'Insertar páginas en blanco',
    tagline: 'Agrega páginas en blanco en las posiciones que indiques.',
    description:
      'Inserta páginas en blanco antes o después de las posiciones que elijas, con el mismo tamaño que la página vecina. Todo ocurre en tu navegador.',
    Icon: FilePlus,
    constraints: [
      'Formato: PDF (un archivo a la vez)',
      'Indica las posiciones donde insertar (p. ej. 1, 3, 5)',
      'Las páginas nuevas heredan el tamaño de su vecina',
    ],
    accent: TONES.slate,
  },
  {
    slug: 'metadatos-pdf',
    href: '/metadatos-pdf',
    category: 'editar',
    name: 'Editar metadatos',
    title: 'Editar metadatos de un PDF',
    tagline: 'Cambia título, autor, asunto y palabras clave del documento.',
    description:
      'Lee y edita los metadatos del PDF (título, autor, asunto, palabras clave, creador) y descarga el documento actualizado. Todo ocurre en tu navegador.',
    Icon: Tags,
    constraints: [
      'Formato: PDF (un archivo a la vez)',
      'Edita título, autor, asunto, palabras clave y creador',
      'No modifica el contenido de las páginas',
    ],
    accent: TONES.indigo,
  },
  {
    slug: 'portada-pdf',
    href: '/portada-pdf',
    category: 'editar',
    name: 'Añadir portada',
    title: 'Añadir una portada al PDF',
    tagline: 'Genera una página de portada con título, subtítulo y fecha.',
    description:
      'Crea una portada con título, subtítulo y fecha en la tipografía del sistema y agrégala al inicio de tu PDF. Todo ocurre en tu navegador.',
    Icon: BookOpen,
    constraints: [
      'Formato: PDF (un archivo a la vez)',
      'Portada con título, subtítulo y fecha',
      'Se inserta como primera página del documento',
    ],
    accent: TONES.pink,
  },
  {
    slug: 'escala-grises',
    href: '/escala-grises',
    category: 'optimizar',
    name: 'Escala de grises',
    title: 'Convertir un PDF a escala de grises',
    tagline: 'Pasa el documento a blanco y negro para imprimir o reducir peso.',
    description:
      'Convierte cada página a escala de grises rasterizándolas, útil para imprimir en monocromo o estandarizar el documento. Todo ocurre en tu navegador.',
    Icon: Contrast,
    constraints: [
      'Formato: PDF (un archivo a la vez)',
      'Cada página se rasteriza en escala de grises',
      'El texto deja de ser seleccionable (se convierte en imagen)',
    ],
    accent: TONES.slate,
  },
  {
    slug: 'info-pdf',
    href: '/info-pdf',
    category: 'optimizar',
    name: 'Información',
    title: 'Información de un PDF',
    tagline: 'Analiza páginas, tamaño, dimensiones, metadatos y cifrado.',
    description:
      'Inspecciona un PDF y muestra su número de páginas, tamaño, dimensiones, metadatos y si está cifrado, sin modificarlo. Todo ocurre en tu navegador.',
    Icon: Info,
    constraints: [
      'Formato: PDF (un archivo a la vez)',
      'Solo analiza: no modifica ni descarga el documento',
      'Muestra páginas, tamaño, dimensiones, metadatos y cifrado',
    ],
    accent: TONES.emerald,
  },
  {
    slug: 'texto-a-pdf',
    href: '/texto-a-pdf',
    category: 'convertir',
    name: 'Texto a PDF',
    title: 'Convertir texto a PDF',
    tagline: 'Escribe o pega texto y genera un PDF paginado al instante.',
    description:
      'Convierte texto plano en un PDF con tamaño de página, fuente y márgenes configurables, con saltos de línea y de página automáticos. Todo ocurre en tu navegador.',
    Icon: Type,
    constraints: [
      'Entrada: texto plano',
      'Tamaño de página, fuente y márgenes configurables',
      'Saltos de línea y de página automáticos',
    ],
    accent: TONES.rose,
  },
  {
    slug: 'extraer-texto',
    href: '/extraer-texto',
    category: 'convertir',
    name: 'Extraer texto',
    title: 'Extraer texto de un PDF',
    tagline: 'Obtén todo el texto del documento como archivo .txt.',
    description:
      'Extrae el texto de cada página de un PDF y descárgalo como archivo .txt, con vista previa antes de guardar. Todo ocurre en tu navegador.',
    Icon: FileText,
    constraints: [
      'Formato: PDF (un archivo a la vez)',
      'Extrae el texto seleccionable de cada página',
      'Los PDF escaneados (imágenes) no contienen texto extraíble',
    ],
    accent: TONES.green,
  },
  {
    slug: 'csv-a-pdf',
    href: '/csv-a-pdf',
    category: 'convertir',
    name: 'CSV a PDF',
    title: 'Convertir CSV a PDF',
    tagline: 'Convierte una tabla CSV en un PDF con formato de tabla.',
    description:
      'Sube o pega datos CSV y genera un PDF con la tabla formateada, con encabezados y paginación automática. Todo ocurre en tu navegador.',
    Icon: Table,
    constraints: [
      'Entrada: archivo .csv o texto separado por comas',
      'Genera una tabla con encabezados y filas',
      'Paginación automática para tablas largas',
    ],
    accent: TONES.orange,
  },
  {
    slug: 'limpiar-metadatos',
    href: '/limpiar-metadatos',
    category: 'seguridad',
    name: 'Quitar metadatos',
    title: 'Quitar metadatos de un PDF',
    tagline: 'Borra autor, título y demás datos ocultos del documento.',
    description:
      'Elimina los metadatos del PDF (autor, título, software, fechas) para proteger tu privacidad antes de compartirlo. Todo ocurre en tu navegador.',
    Icon: Eraser,
    constraints: [
      'Formato: PDF (un archivo a la vez)',
      'Borra autor, título, asunto, palabras clave y creador',
      'No modifica el contenido de las páginas',
    ],
    accent: TONES.sky,
  },
  {
    slug: 'aplanar-pdf',
    href: '/aplanar-pdf',
    category: 'seguridad',
    name: 'Aplanar PDF',
    title: 'Aplanar un PDF',
    tagline: 'Fija formularios y anotaciones para que no se puedan editar.',
    description:
      'Aplana los campos de formulario y anotaciones del PDF para que su contenido quede fijo y no pueda modificarse. Todo ocurre en tu navegador.',
    Icon: Layers,
    constraints: [
      'Formato: PDF (un archivo a la vez)',
      'Fija los campos de formulario en su valor actual',
      'Tras aplanar, los formularios dejan de ser editables',
    ],
    accent: TONES.purple,
  },
  {
    slug: 'contrasena-pdf',
    href: '/contrasena-pdf',
    category: 'seguridad',
    name: 'Proteger PDF',
    title: 'Proteger o quitar contraseña de un PDF',
    tagline: 'Cifra tu PDF con contraseña, o quítasela si ya la conoces.',
    description:
      'Protege un PDF con contraseña (cifrado AES-256) para que pida clave al abrirse, o quítale la contraseña si ya la sabes. Todo ocurre en tu navegador; el archivo nunca se sube.',
    Icon: Lock,
    constraints: [
      'Formato: PDF (un archivo a la vez)',
      'Proteger: cifra con AES-256 y pide la contraseña al abrir',
      'Quitar: necesitas saber la contraseña actual del PDF',
      'El archivo nunca sale de tu dispositivo',
    ],
    accent: TONES.rose,
  },
];

export const getTool = (slug: ToolSlug): ToolDef =>
  TOOLS.find((t) => t.slug === slug)!;

/** Etiqueta visible de cada categoría. */
export const CATEGORY_LABELS: Record<ToolCategory, string> = {
  organizar: 'Organizar',
  editar: 'Editar',
  convertir: 'Convertir',
  optimizar: 'Optimizar',
  seguridad: 'Privacidad',
};

/** Orden en que se muestran las categorías en nav, landing y footer. */
export const CATEGORY_ORDER: ToolCategory[] = [
  'organizar',
  'editar',
  'convertir',
  'optimizar',
  'seguridad',
];

/** Herramientas agrupadas por categoría, en el orden de `CATEGORY_ORDER`. */
export const toolsByCategory = (): {
  category: ToolCategory;
  label: string;
  tools: ToolDef[];
}[] =>
  CATEGORY_ORDER.map((category) => ({
    category,
    label: CATEGORY_LABELS[category],
    tools: TOOLS.filter((t) => t.category === category),
  })).filter((group) => group.tools.length > 0);
