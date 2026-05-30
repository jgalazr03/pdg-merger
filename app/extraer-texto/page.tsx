import type { Metadata } from 'next';
import TextExtractorLoader from '@/components/tools/TextExtractorLoader';
import { getTool } from '@/lib/tools';

const tool = getTool('extraer-texto');

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
};

export default function ExtraerTextoPage() {
  return <TextExtractorLoader />;
}
