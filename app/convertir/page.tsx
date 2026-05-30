import type { Metadata } from 'next';
import ConverterLoader from '@/components/tools/ConverterLoader';
import { getTool } from '@/lib/tools';

const tool = getTool('convertir');

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
};

export default function ConvertirPage() {
  return <ConverterLoader />;
}
