import type { Metadata } from 'next';
import BlankPagesInserter from '@/components/BlankPagesInserter';
import { getTool } from '@/lib/tools';

const tool = getTool('paginas-en-blanco');

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
};

export default function PaginasEnBlancoPage() {
  return <BlankPagesInserter />;
}
