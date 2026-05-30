import type { Metadata } from 'next';
import ImageStamper from '@/components/ImageStamper';
import { getTool } from '@/lib/tools';

const tool = getTool('sello-imagen');

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
};

export default function SelloImagenPage() {
  return <ImageStamper />;
}
