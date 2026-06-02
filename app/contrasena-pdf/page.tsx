import type { Metadata } from 'next';
import PasswordLoader from '@/components/tools/PasswordLoader';
import { getTool } from '@/lib/tools';

const tool = getTool('contrasena-pdf');

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
};

export default function ContrasenaPdfPage() {
  return <PasswordLoader />;
}
