import type { Metadata } from 'next';
import MetadataCleaner from '@/components/MetadataCleaner';
import { getTool } from '@/lib/tools';

const tool = getTool('limpiar-metadatos');

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
};

export default function LimpiarMetadatosPage() {
  return <MetadataCleaner />;
}
