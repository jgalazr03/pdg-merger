import type { Metadata } from 'next';
import PDFResizer from '@/components/PDFResizer';
import { getTool } from '@/lib/tools';

const tool = getTool('redimensionar-pdf');

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
};

export default function RedimensionarPdfPage() {
  return <PDFResizer />;
}
