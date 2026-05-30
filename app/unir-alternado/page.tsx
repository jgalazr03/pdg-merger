import type { Metadata } from 'next';
import AlternateMerger from '@/components/AlternateMerger';
import { getTool } from '@/lib/tools';

const tool = getTool('unir-alternado');

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
};

export default function UnirAlternadoPage() {
  return <AlternateMerger />;
}
