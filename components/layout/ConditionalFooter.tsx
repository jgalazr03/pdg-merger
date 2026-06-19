'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import SiteFooter from './SiteFooter';

/**
 * El footer de marketing (enlaces, legal, branding) solo vive en superficies de
 * marketing. Las herramientas son un espacio de trabajo enfocado: barra superior
 * + lienzo a pantalla completa, sin footer que distraiga durante la tarea
 * (patrón de Figma, Linear, Notion, Stripe Dashboard). La privacidad ya se
 * comunica dentro de cada herramienta, en el hero del ToolShell.
 *
 * Superficies de marketing/descubrimiento (llevan footer): la portada de cada
 * módulo (`/` = Documentos, `/medios`) y el índice global (`/herramientas`).
 */
const MARKETING_ROUTES = new Set(['/', '/medios', '/herramientas']);

export default function ConditionalFooter() {
  const pathname = usePathname();
  const showFooter = MARKETING_ROUTES.has(pathname);

  // Activa el overscroll de dos tonos (papel arriba / navy abajo, ver
  // globals.css) solo donde hay footer; las herramientas quedan en papel.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('has-footer', showFooter);
    return () => root.classList.remove('has-footer');
  }, [showFooter]);

  if (!showFooter) return null;
  return <SiteFooter />;
}
