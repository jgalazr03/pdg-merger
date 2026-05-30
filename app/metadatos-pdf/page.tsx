import type { Metadata } from 'next';
import MetadataEditor from '@/components/MetadataEditor';
import { getTool } from '@/lib/tools';

const tool = getTool('metadatos-pdf');

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
};

export default function MetadatosPdfPage() {
  return <MetadataEditor />;
}
