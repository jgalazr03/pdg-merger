import type { Metadata } from 'next';
import ExcelMergerLoader from '@/components/tools/ExcelMergerLoader';
import { getTool } from '@/lib/tools';

const tool = getTool('unir-excel');

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
};

export default function UnirExcelPage() {
  return <ExcelMergerLoader />;
}
