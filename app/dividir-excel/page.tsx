import type { Metadata } from 'next';
import ExcelSplitterLoader from '@/components/tools/ExcelSplitterLoader';
import { getTool } from '@/lib/tools';

const tool = getTool('dividir-excel');

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
};

export default function DividirExcelPage() {
  return <ExcelSplitterLoader />;
}
