import type { Metadata } from 'next';
import PDFInspector from '@/components/PDFInspector';
import { getTool } from '@/lib/tools';

const tool = getTool('info-pdf');

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
};

export default function InfoPdfPage() {
  return <PDFInspector />;
}
