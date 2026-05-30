import type { Metadata } from 'next';
import TextToPDF from '@/components/TextToPDF';
import { getTool } from '@/lib/tools';

const tool = getTool('texto-a-pdf');

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
};

export default function TextoAPdfPage() {
  return <TextToPDF />;
}
