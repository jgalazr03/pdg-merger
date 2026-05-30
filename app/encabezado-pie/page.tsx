import type { Metadata } from 'next';
import HeaderFooter from '@/components/HeaderFooter';
import { getTool } from '@/lib/tools';

const tool = getTool('encabezado-pie');

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
};

export default function EncabezadoPiePage() {
  return <HeaderFooter />;
}
