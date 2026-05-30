import type { Metadata } from 'next';
import GrayscaleConverterLoader from '@/components/tools/GrayscaleConverterLoader';
import { getTool } from '@/lib/tools';

const tool = getTool('escala-grises');

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
};

export default function EscalaGrisesPage() {
  return <GrayscaleConverterLoader />;
}
