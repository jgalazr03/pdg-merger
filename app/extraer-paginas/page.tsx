import type { Metadata } from 'next';
import PageExtractor from '@/components/PageExtractor';
import { getTool } from '@/lib/tools';

const tool = getTool('extraer-paginas');

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
};

export default function ExtraerPaginasPage() {
  return <PageExtractor />;
}
