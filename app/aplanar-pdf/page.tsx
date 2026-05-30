import type { Metadata } from 'next';
import PDFFlattener from '@/components/PDFFlattener';
import { getTool } from '@/lib/tools';

const tool = getTool('aplanar-pdf');

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
};

export default function AplanarPdfPage() {
  return <PDFFlattener />;
}
