import type { Metadata } from 'next';
import CompressorLoader from '@/components/tools/CompressorLoader';
import { getTool } from '@/lib/tools';

const tool = getTool('comprimir');

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
};

export default function ComprimirPage() {
  return <CompressorLoader />;
}
