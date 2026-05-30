import type { Metadata } from 'next';
import PDFCropper from '@/components/PDFCropper';
import { getTool } from '@/lib/tools';

const tool = getTool('recortar-pdf');

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
};

export default function RecortarPdfPage() {
  return <PDFCropper />;
}
