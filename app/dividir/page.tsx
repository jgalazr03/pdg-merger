import type { Metadata } from 'next';
import PDFSplitter from '@/components/PDFSplitter';
import { getTool } from '@/lib/tools';

const tool = getTool('dividir');

export const metadata: Metadata = {
  title: `${tool.title} | GAINCO`,
  description: tool.description,
};

export default function DividirPage() {
  return <PDFSplitter />;
}
