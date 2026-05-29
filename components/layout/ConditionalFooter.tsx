'use client';

import { usePathname } from 'next/navigation';
import SiteFooter from './SiteFooter';

/**
 * El footer de marketing (enlaces, legal, branding) solo vive en superficies de
 * marketing. Las herramientas son un espacio de trabajo enfocado: barra superior
 * + lienzo a pantalla completa, sin footer que distraiga durante la tarea
 * (patrón de Figma, Linear, Notion, Stripe Dashboard). La privacidad ya se
 * comunica dentro de cada herramienta, en el hero del ToolShell.
 */
const MARKETING_ROUTES = new Set(['/']);

export default function ConditionalFooter() {
  const pathname = usePathname();
  if (!MARKETING_ROUTES.has(pathname)) return null;
  return <SiteFooter />;
}
