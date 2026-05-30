import type { Metadata } from 'next';
import CsvToPDF from '@/components/CsvToPDF';
import { getTool } from '@/lib/tools';

const tool = getTool('csv-a-pdf');

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
};

export default function CsvAPdfPage() {
  return <CsvToPDF />;
}
