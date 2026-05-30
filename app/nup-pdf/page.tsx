import type { Metadata } from 'next';
import NupComposer from '@/components/NupComposer';
import { getTool } from '@/lib/tools';

const tool = getTool('nup-pdf');

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
};

export default function NupPdfPage() {
  return <NupComposer />;
}
