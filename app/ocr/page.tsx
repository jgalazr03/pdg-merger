import type { Metadata } from 'next';
import OcrLoader from '@/components/tools/OcrLoader';
import { getTool } from '@/lib/tools';

const tool = getTool('ocr');

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
};

export default function OcrPage() {
  return <OcrLoader />;
}
