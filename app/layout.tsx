import './globals.css';
import type { Metadata } from 'next';
import { Archivo, IBM_Plex_Sans } from 'next/font/google';
import { Analytics } from "@vercel/analytics/next"
import SiteHeader from '@/components/layout/SiteHeader';
import SiteFooter from '@/components/layout/SiteFooter';
import { Toaster } from '@/components/ui/sonner';

// Display industrial con presencia (títulos / wordmark)
const archivo = Archivo({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
});

// Body humanista técnica (UI / texto)
const plex = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Herramientas PDF y Excel | GAINCO',
  description:
    'Une, divide y comprime archivos PDF y Excel de forma rápida y segura, directo desde tu navegador.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${archivo.variable} ${plex.variable}`}>
      <body className="flex min-h-screen flex-col bg-surface font-sans text-ink antialiased">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
        <Toaster position="top-right" />
        <Analytics />
      </body>
    </html>
  );
}
