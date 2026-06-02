import type { Metadata } from 'next';
import FormFiller from '@/components/FormFiller';
import { getTool } from '@/lib/tools';

const tool = getTool('rellenar-formularios');

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
};

export default function RellenarFormulariosPage() {
  return <FormFiller />;
}
