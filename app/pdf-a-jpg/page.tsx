import type { Metadata } from 'next';
import PDFToJPGLoader from '@/components/tools/PDFToJPGLoader';
import { getTool } from '@/lib/tools';

const tool = getTool('pdf-a-jpg');

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
};

export default function PdfAJpgPage() {
  return <PDFToJPGLoader />;
}
