import type { Metadata } from 'next';
import AnalizarReunionLoader from '@/components/tools/AnalizarReunionLoader';
import { getTool } from '@/lib/tools';

const tool = getTool('analizar-reunion');

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
};

export default function AnalizarReunionPage() {
  return <AnalizarReunionLoader />;
}
