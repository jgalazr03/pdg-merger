import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Analytics } from "@vercel/analytics/next"

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Herramientas PDF | GAINCO',
  description: 'Herramientas relacionadas a la modificación y gestión de archivos PDFs.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body 
        className={inter.className}>
        {children} 
        <Analytics/>
      </body>
    </html>
  );
}
