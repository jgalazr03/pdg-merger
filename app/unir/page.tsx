import type { Metadata } from 'next';
import PDFMerger from '@/components/PDFMerger';
import { getTool } from '@/lib/tools';

const tool = getTool('unir');

export const metadata: Metadata = {
  title: `${tool.title} | GAINCO`,
  description: tool.description,
};

export default function UnirPage() {
  return <PDFMerger />;
}
