import type { Metadata } from 'next';
import CoverPageMaker from '@/components/CoverPageMaker';
import { getTool } from '@/lib/tools';

const tool = getTool('portada-pdf');

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
};

export default function PortadaPdfPage() {
  return <CoverPageMaker />;
}
