import type { Metadata } from 'next';
import PageNumberer from '@/components/PageNumberer';
import { getTool } from '@/lib/tools';

const tool = getTool('numerar-paginas');

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
};

export default function NumerarPaginasPage() {
  return <PageNumberer />;
}
