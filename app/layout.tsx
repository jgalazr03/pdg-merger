import './globals.css';
import type { Metadata } from 'next';
import { Roboto_Mono } from 'next/font/google';
import { Analytics } from "@vercel/analytics/next"
import SiteHeader from '@/components/layout/SiteHeader';
import ConditionalFooter from '@/components/layout/ConditionalFooter';
import { Toaster } from '@/components/ui/sonner';

// Tipografía única del sistema (invariante): monoespaciada. Jerarquía solo por
// tamaño/peso/color, nunca mezclando familias.
const robotoMono = Roboto_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Herramientas | GAINCO',
    template: '%s | GAINCO',
  },
  description:
    'Une, divide, comprime y convierte archivos PDF y Excel de forma rápida y segura, directo desde tu navegador.',
  // Favicon: isotipo de marca en SVG que cambia de color con el tema del sistema
  // (claro/oscuro) mediante prefers-color-scheme embebido en el propio archivo.
  // Next.js genera <link rel="icon" type="image/svg+xml" href="/favicon.svg">.
  icons: {
    icon: { url: '/favicon.svg', type: 'image/svg+xml' },
  },
  // Viewport móvil: ocupa el área completa (incluye notch/safe-areas vía
  // `viewport-fit=cover`) y PERMITE el zoom del usuario (a11y: nunca
  // `maximum-scale` ni `user-scalable=no`). El zoom indeseado al enfocar inputs
  // se evita con font ≥16px, no deshabilitando el gesto. En Next 13.5.1 el
  // viewport/themeColor viven dentro de `metadata` (el export `viewport`
  // separado llegó en Next 14).
  viewport: {
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',
  },
  themeColor: '#fcfaf7',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={robotoMono.variable}>
      <body className="flex min-h-screen flex-col bg-surface font-mono text-ink antialiased supports-[min-height:100dvh]:min-h-[100dvh]">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <ConditionalFooter />
        <Toaster position="top-right" />
        <Analytics />
      </body>
    </html>
  );
}
