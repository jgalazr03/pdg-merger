// Vocabulario personalizado del despacho (nombres de clientes, siglas internas,
// productos). Se guarda en localStorage —la herramienta es client-side, sin
// backend de cuentas— y se envía como `keyterms` al modo servidor para sumarlo
// al diccionario de dominio en el reconocimiento. Ver [[lib/keyterms]].

const KEY = 'gainco:medios:vocab';
const MAX_TERMS = 50;
const MAX_LEN = 60;

/** Lee el vocabulario guardado (vacío en SSR o si no hay nada). */
export function loadVocab(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr)
      ? arr.filter((t): t is string => typeof t === 'string')
      : [];
  } catch {
    return [];
  }
}

/** Normaliza (recorta, dedup, tope) y guarda el vocabulario. Devuelve el final. */
export function saveVocab(terms: string[]): string[] {
  const clean = Array.from(
    new Set(terms.map((t) => t.trim().slice(0, MAX_LEN)).filter(Boolean))
  ).slice(0, MAX_TERMS);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(clean));
    } catch {
      // Sin persistencia (modo privado/cuota): se usa solo en memoria.
    }
  }
  return clean;
}

export const VOCAB_MAX_TERMS = MAX_TERMS;
