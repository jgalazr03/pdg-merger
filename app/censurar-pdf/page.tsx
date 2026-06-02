import type { Metadata } from 'next';
import RedactToolLoader from '@/components/tools/RedactToolLoader';
import { getTool } from '@/lib/tools';

const tool = getTool('censurar-pdf');

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
};

export default function CensurarPdfPage() {
  return <RedactToolLoader />;
}
