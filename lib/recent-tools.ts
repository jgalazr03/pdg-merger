import { useEffect, useState } from 'react';
import { TOOLS, type ToolDef } from '@/lib/tools';

/**
 * Herramientas recientes, persistidas SOLO en el equipo (localStorage). Coherente
 * con la invariante de privacidad: nada sale del dispositivo. Se guarda una lista
 * de slugs (más reciente primero), acotada, y se valida contra el catálogo al
 * leer para tolerar slugs viejos/renombrados.
 */
const KEY = 'gainco:recent-tools';
const MAX = 6;
const CHANGED_EVENT = 'gainco:recent-tools-changed';

function readSlugs(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const arr: unknown = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((s): s is string => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

/** Registra una visita: mueve el slug al frente y acota la lista. */
export function recordToolVisit(slug: string): void {
  if (typeof window === 'undefined') return;
  try {
    const next = [slug, ...readSlugs().filter((s) => s !== slug)].slice(0, MAX);
    window.localStorage.setItem(KEY, JSON.stringify(next));
    // Avisar a los oyentes de la misma pestaña (la landing/el palette reaccionan).
    window.dispatchEvent(new Event(CHANGED_EVENT));
  } catch {
    /* localStorage no disponible (modo privado/bloqueado): degradar en silencio. */
  }
}

/**
 * Herramientas recientes (más reciente primero), resueltas a `ToolDef`. Devuelve
 * `[]` en SSR y en el primer render del cliente para evitar desajuste de
 * hidratación; se rellena tras montar y se mantiene al día con los cambios.
 */
export function useRecentTools(limit = MAX): ToolDef[] {
  const [slugs, setSlugs] = useState<string[]>([]);
  useEffect(() => {
    const sync = () => setSlugs(readSlugs());
    sync();
    window.addEventListener(CHANGED_EVENT, sync);
    window.addEventListener('storage', sync); // cambios desde otra pestaña
    return () => {
      window.removeEventListener(CHANGED_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  return slugs
    .map((slug) => TOOLS.find((t) => t.slug === slug))
    .filter((t): t is ToolDef => Boolean(t))
    .slice(0, limit);
}
