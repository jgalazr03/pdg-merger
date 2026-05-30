import type { Metadata } from 'next';
import OrganizerLoader from '@/components/tools/OrganizerLoader';
import { getTool } from '@/lib/tools';

const tool = getTool('organizar');

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
};

export default function OrganizarPage() {
  return <OrganizerLoader />;
}
