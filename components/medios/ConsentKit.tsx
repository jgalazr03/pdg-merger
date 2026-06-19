'use client';

import { useState } from 'react';
import { ShieldCheck, ChevronDown, Laptop, Cloud } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ToolAccent } from '@/lib/tools';
import { CONSENT_TEMPLATE } from '@/lib/consent';
import { downloadMarkdownAsDocx } from '@/lib/docx';
import { toast } from 'sonner';
import DownloadMenu from '@/components/medios/DownloadMenu';

function downloadText(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Disclosure de "Privacidad y consentimiento (LFPDPPP)": explica el flujo de
 * datos por modo (local = nada sale; servidor = transferencia internacional) y
 * ofrece una plantilla descargable de consentimiento + aviso de privacidad para
 * usar con clientes. Colapsado por defecto para no estorbar.
 */
export default function ConsentKit({ accent }: { accent: ToolAccent }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-8 rounded-lg border-2 border-ink/15 bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors duration-150 hover-fine:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
      >
        <ShieldCheck className={cn('h-4 w-4 shrink-0', accent.text)} strokeWidth={2.5} />
        <span className="flex-1 text-sm font-bold text-ink">
          Privacidad y consentimiento (LFPDPPP)
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150',
            open && 'rotate-180'
          )}
        />
      </button>

      {open && (
        <div className="border-t-2 border-ink/10 px-3 py-3 motion-safe:animate-fade-in">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border-2 border-ink/15 p-2.5">
              <p className="mb-0.5 flex items-center gap-1.5 text-xs font-bold text-ink">
                <Laptop className="h-3.5 w-3.5" strokeWidth={2.5} />
                En tu navegador
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                El audio no sale de tu equipo. Sin transferencia a terceros.
              </p>
            </div>
            <div className="rounded-lg border-2 border-ink/15 p-2.5">
              <p className="mb-0.5 flex items-center gap-1.5 text-xs font-bold text-ink">
                <Cloud className="h-3.5 w-3.5" strokeWidth={2.5} />
                En el servidor
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Se procesa en Deepgram (EE. UU.) y se borra: es transferencia
                internacional.
              </p>
            </div>
          </div>

          <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">
            Los datos financieros son sensibles: la LFPDPPP exige{' '}
            <span className="font-medium text-ink">consentimiento expreso</span>.
            Usa esta plantilla con los participantes (adáptala con tu área legal;
            no es asesoría jurídica).
          </p>

          <div className="mt-3">
            <DownloadMenu
              className={accent.solid}
              items={[
                {
                  label: 'Plantilla Word (.docx)',
                  onSelect: () => {
                    void downloadMarkdownAsDocx(
                      CONSENT_TEMPLATE,
                      'consentimiento-grabacion.docx'
                    )
                      .then(() => toast.success('Plantilla descargada'))
                      .catch(() => toast.error('No se pudo generar el Word'));
                  },
                },
                {
                  label: 'Plantilla Markdown (.md)',
                  onSelect: () =>
                    downloadText(CONSENT_TEMPLATE, 'consentimiento-grabacion.md'),
                },
              ]}
            />
          </div>
        </div>
      )}
    </div>
  );
}
