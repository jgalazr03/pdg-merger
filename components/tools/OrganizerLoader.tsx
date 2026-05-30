'use client';

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

const PDFOrganizer = dynamic(() => import('@/components/PDFOrganizer'), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  ),
});

export default function OrganizerLoader() {
  return <PDFOrganizer />;
}
