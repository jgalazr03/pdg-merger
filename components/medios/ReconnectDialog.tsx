'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { Upload } from 'lucide-react';
import type { ToolAccent } from '@/lib/tools';
import { clock } from '@/lib/transcript';
import { Button } from '@/components/ui/button';

/**
 * Aviso al tocar un momento de una transcripción reabierta sin su audio: explica
 * por qué hace falta el archivo antes de abrir el selector (abrirlo sin más
 * desconcierta) y promete lo que pasa después: se salta a ese momento. Mismo
 * Dialog de Radix y estilo que la paleta ⌘K.
 */
export default function ReconnectDialog({
  open,
  onOpenChange,
  time,
  fileName,
  accent,
  onChoose,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Momento que se pidió escuchar (segundos); null si no hay uno concreto. */
  time: number | null;
  fileName: string | null;
  accent: ToolAccent;
  /** Abre el selector de archivo (debe llamarse dentro del gesto del usuario). */
  onChoose: () => void;
}) {
  const file = fileName ?? 'el archivo original';
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(28rem,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-xl border-4 border-ink bg-surface p-5 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 sm:p-6">
          <Dialog.Title className="text-lg font-bold leading-tight text-ink [text-wrap:balance]">
            {time != null
              ? `Reconecta el audio para escuchar el ${clock(time)}`
              : 'Reconecta el audio para escuchar'}
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm leading-relaxed text-ink">
            Vuelve a seleccionar{' '}
            <span className="break-words font-bold">{file}</span>
            {time != null
              ? ' y te llevamos directo a ese momento.'
              : ' para reproducir la grabación.'}
          </Dialog.Description>
          <p className="mt-2 text-xs text-muted-foreground">
            El historial guarda la transcripción y lo generado con IA, no el audio.
          </p>
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Dialog.Close asChild>
              <Button variant="outline">Ahora no</Button>
            </Dialog.Close>
            <Button className={accent.solid} onClick={onChoose} autoFocus>
              <Upload className="mr-2 h-4 w-4" />
              Seleccionar archivo
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
