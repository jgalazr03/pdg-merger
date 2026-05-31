'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { TOOLS } from '@/lib/tools';
import { recordToolVisit } from '@/lib/recent-tools';

/**
 * Registra la herramienta visitada al cambiar de ruta. Global (montado en el
 * layout) para no depender de que cada herramienta lo invoque. Solo guarda en el
 * equipo (ver recent-tools).
 */
export default function ToolVisitTracker() {
  const pathname = usePathname();
  useEffect(() => {
    const tool = TOOLS.find(
      (t) => pathname === t.href || pathname.startsWith(`${t.href}/`)
    );
    if (tool) recordToolVisit(tool.slug);
  }, [pathname]);
  return null;
}
