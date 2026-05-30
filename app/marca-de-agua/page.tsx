import type { Metadata } from 'next';
import Watermarker from '@/components/Watermarker';
import { getTool } from '@/lib/tools';

const tool = getTool('marca-de-agua');

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
};

export default function MarcaDeAguaPage() {
  return <Watermarker />;
}
