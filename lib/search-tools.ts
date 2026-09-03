import type { ToolSlug } from './tools';

/**
 * Buscador único del catálogo. Lo usan ⌘K, el catálogo de la landing y el panel
 * móvil del header, para que el mismo término dé el mismo resultado en las tres
 * superficies. Puro (sin React ni DOM): se puede probar en Node.
 *
 *  - Insensible a mayúsculas y acentos. Se puede escribir a medias ("compr").
 *  - Varias palabras: TODAS deben aparecer (en cualquier campo); se ignoran
 *    conectores ("a", "de", "en"…), así "pdf a jpg" busca "pdf" y "jpg".
 *  - Tolera plural e infinitivo por raíz como prefijo de palabra: "páginas" →
 *    "pagina", "combinar" → "combina", "comprimido" → "comprim".
 *  - Ranking por dónde aparece: nombre > sinónimos (`keywords`) > título >
 *    tagline > descripción. Empates, en el orden del catálogo.
 */

export interface SearchableTool {
  name: string;
  title: string;
  tagline: string;
  description: string;
  keywords: readonly string[];
}

export const normalizeText = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const STOPWORDS = new Set([
  'a', 'al', 'de', 'del', 'el', 'la', 'lo', 'los', 'las', 'un', 'una', 'unos',
  'unas', 'y', 'o', 'u', 'e', 'en', 'con', 'para', 'por', 'que', 'mi', 'mis',
  'tu', 'tus', 'su', 'sus', 'the', 'to', 'of', 'and', 'in', 'for', 'from',
]);

const tokenize = (query: string): string[] =>
  normalizeText(query)
    .split(' ')
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));

/** Raíces de un término para tolerar plural, infinitivo y participio. */
const stems = (token: string): string[] => {
  if (token.length < 4) return [];
  const out = new Set<string>();
  if (token.endsWith('es')) out.add(token.slice(0, -2));
  if (token.endsWith('s')) out.add(token.slice(0, -1));
  if (/[aei]r$/.test(token)) {
    out.add(token.slice(0, -1)); // combinar → combina
    out.add(token.slice(0, -2)); // comprimir → comprim
  }
  const participle = token.replace(/(ado|ido|ada|ida|ando|iendo)$/, '');
  if (participle !== token) out.add(participle); // comprimido → comprim
  out.delete(token);
  return Array.from(out).filter((s) => s.length >= 3);
};

interface Field {
  text: string;
  words: string[];
}
interface Index {
  name: Field;
  keywords: Field[];
  title: Field;
  tagline: Field;
  description: Field;
}

const toField = (s: string): Field => {
  const text = normalizeText(s);
  return { text, words: text.split(/[^a-z0-9]+/).filter(Boolean) };
};

const INDEX_CACHE = new WeakMap<SearchableTool, Index>();
const indexOf = (tool: SearchableTool): Index => {
  let idx = INDEX_CACHE.get(tool);
  if (!idx) {
    idx = {
      name: toField(tool.name),
      keywords: tool.keywords.map(toField),
      title: toField(tool.title),
      tagline: toField(tool.tagline),
      description: toField(tool.description),
    };
    INDEX_CACHE.set(tool, idx);
  }
  return idx;
};

const WEIGHT = {
  nameExact: 100,
  nameWord: 80,
  name: 60,
  keywordExact: 55,
  keyword: 50,
  title: 40,
  tagline: 25,
  description: 10,
} as const;

const includes = (f: Field, token: string) => f.text.includes(token);
const startsWord = (f: Field, stem: string) =>
  f.words.some((w) => w.startsWith(stem));

/** Puntuación de UN término contra una herramienta (0 = no aparece). */
const scoreToken = (idx: Index, token: string): number => {
  // 1) Literal (permite escribir a medias). Se toma el campo de más peso.
  if (idx.name.text === token) return WEIGHT.nameExact;
  if (startsWord(idx.name, token)) return WEIGHT.nameWord;
  if (includes(idx.name, token)) return WEIGHT.name;
  if (idx.keywords.some((k) => k.text === token)) return WEIGHT.keywordExact;
  // Sinónimos por prefijo de palabra, no subcadena: "word" no debe casar con
  // "password".
  if (idx.keywords.some((k) => startsWord(k, token))) return WEIGHT.keyword;
  if (includes(idx.title, token)) return WEIGHT.title;
  if (includes(idx.tagline, token)) return WEIGHT.tagline;
  if (includes(idx.description, token)) return WEIGHT.description;

  // 2) Sin literal: raíz como PREFIJO de palabra (no subcadena, para que "unir"
  //    no case con "reunión"). La descripción queda fuera: es prosa larga y
  //    por raíz solo aporta ruido ("numerar" → "número de páginas").
  let best = 0;
  for (const stem of stems(token)) {
    if (startsWord(idx.name, stem)) best = Math.max(best, WEIGHT.nameWord);
    else if (idx.keywords.some((k) => startsWord(k, stem)))
      best = Math.max(best, WEIGHT.keyword);
    else if (startsWord(idx.title, stem)) best = Math.max(best, WEIGHT.title);
    else if (startsWord(idx.tagline, stem)) best = Math.max(best, WEIGHT.tagline);
  }
  return best;
};

/** Puntuación total de una consulta (0 si algún término no aparece). */
export const scoreTool = (tool: SearchableTool, query: string): number => {
  const tokens = tokenize(query);
  if (tokens.length === 0) return 0;
  const idx = indexOf(tool);
  let total = 0;
  for (const token of tokens) {
    const s = scoreToken(idx, token);
    if (s === 0) return 0;
    total += s;
  }
  return total;
};

/**
 * Herramientas de `pool` que coinciden con `query`, de mayor a menor relevancia.
 * `pool` permite acotar antes (módulo, categoría) y conservar su orden en empates.
 */
export const searchTools = <T extends SearchableTool>(
  pool: readonly T[],
  query: string
): T[] =>
  pool
    .map((tool, order) => ({ tool, order, score: scoreTool(tool, query) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .map((r) => r.tool);

/**
 * Intenciones frecuentes que el hub NO cubre (vocabulario que traen quienes
 * venían de iLovePDF). En vez de un "Sin resultados" mudo, se dice qué hacer.
 */
export interface UnavailableIntent {
  /** Términos que delatan la intención: palabra suelta (coincidencia exacta de
   *  palabra) o frase (subcadena). Se normalizan al comparar. */
  match: string[];
  /** La tarea, en palabras del usuario. */
  label: string;
  /** Qué hacer en su lugar. Corto y honesto. */
  hint: string;
  /** Herramienta del hub que cubre parte de la necesidad. */
  alternative?: ToolSlug;
}

export const UNAVAILABLE_INTENTS: UnavailableIntent[] = [
  {
    match: ['word', 'docx', 'doc', 'pdf to word', 'word to pdf'],
    label: 'Convertir entre PDF y Word',
    hint: 'De Word a PDF: en Word, Archivo › Guardar como › PDF. De PDF a Word: recupera el contenido con Extraer texto y pégalo en Word.',
    alternative: 'extraer-texto',
  },
  {
    match: ['powerpoint', 'pptx', 'ppt', 'presentacion', 'presentación'],
    label: 'Convertir presentaciones',
    hint: 'En PowerPoint: Archivo › Exportar › Crear PDF. El hub no convierte presentaciones.',
  },
  {
    match: ['excel a pdf', 'xlsx a pdf', 'pdf a excel', 'pdf a xlsx', 'excel to pdf', 'pdf to excel'],
    label: 'Convertir entre Excel y PDF',
    hint: 'En Excel: Archivo › Guardar como › PDF. Para una tabla CSV existe CSV a PDF.',
    alternative: 'csv-a-pdf',
  },
  {
    match: ['reparar', 'repair', 'corrupto', 'dañado', 'danado', 'no abre'],
    label: 'Reparar un PDF dañado',
    hint: 'El hub no repara archivos. Prueba abrirlo en el navegador e imprimirlo como PDF; si no abre, hace falta una herramienta de escritorio.',
  },
  {
    match: ['comparar', 'compare', 'diferencias', 'versiones'],
    label: 'Comparar dos PDF',
    hint: 'El hub no compara documentos. Extrae el texto de ambos y compáralos en tu editor.',
    alternative: 'extraer-texto',
  },
  {
    match: ['html a pdf', 'pagina web', 'página web', 'sitio web', 'url a pdf', 'web a pdf', 'html to pdf'],
    label: 'Guardar una página web como PDF',
    hint: 'Desde el navegador: Imprimir › Guardar como PDF. No hace falta el hub.',
  },
  {
    match: ['editar texto', 'modificar texto', 'cambiar texto', 'corregir texto', 'editar pdf', 'edit pdf'],
    label: 'Editar el texto de un PDF',
    hint: 'El hub no reescribe el texto de un PDF. Sí puedes censurar, firmar, estampar, numerar o añadir encabezados.',
  },
  {
    match: ['pdf/a', 'pdfa', 'archivado'],
    label: 'Convertir a PDF/A',
    hint: 'El hub no genera PDF/A: la validación del estándar no se hace en el navegador.',
  },
  {
    match: ['escanear', 'escáner', 'escaner', 'scan to pdf', 'fotos a pdf'],
    label: 'Escanear a PDF',
    hint: 'Toma fotos con el teléfono y únelas en un PDF con Unir; después OCR las vuelve buscables.',
    alternative: 'unir',
  },
];

export const findUnavailableIntent = (
  query: string
): UnavailableIntent | undefined => {
  const q = normalizeText(query);
  if (!q) return undefined;
  const words = new Set(q.split(' '));
  return UNAVAILABLE_INTENTS.find((intent) =>
    intent.match.some((raw) => {
      const term = normalizeText(raw);
      return term.includes(' ') ? q.includes(term) : words.has(term);
    })
  );
};
