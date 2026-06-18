import type { Metadata } from 'next';
import TranscriberLoader from '@/components/tools/TranscriberLoader';
import { getTool } from '@/lib/tools';

const tool = getTool('transcribir');

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
};

export default function TranscribirPage() {
  return <TranscriberLoader />;
}
