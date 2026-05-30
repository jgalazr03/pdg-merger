import type { Metadata } from 'next';
import RotatorLoader from '@/components/tools/RotatorLoader';
import { getTool } from '@/lib/tools';

const tool = getTool('girar');

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
};

export default function GirarPage() {
  return <RotatorLoader />;
}
