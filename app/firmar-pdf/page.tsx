import type { Metadata } from 'next';
import PDFSigner from '@/components/PDFSigner';
import { getTool } from '@/lib/tools';

const tool = getTool('firmar-pdf');

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
};

export default function FirmarPdfPage() {
  return <PDFSigner />;
}
