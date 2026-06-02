'use client';

import { useState } from 'react';
import { Hash } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { getTool } from '@/lib/tools';
import { useBatchProcessor } from '@/hooks/use-batch-processor';
import {
  numberPdf,
  type PageNumberParams,
  type Position,
  type Format,
} from '@/lib/page-numbers';
import ToolShell from '@/components/tools/ToolShell';
import FileDropzone from '@/components/tools/FileDropzone';
import ToolConstraints from '@/components/tools/ToolConstraints';
import BatchPanel from '@/components/tools/BatchPanel';

const tool = getTool('numerar-paginas');
const accent = tool.accent;

const isPdf = (f: File) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name);

const POSITIONS: { value: Position; label: string }[] = [
  { value: 'inferior-centro', label: 'Inferior centro' },
  { value: 'inferior-derecha', label: 'Inferior derecha' },
  { value: 'inferior-izquierda', label: 'Inferior izquierda' },
  { value: 'superior-centro', label: 'Superior centro' },
  { value: 'superior-derecha', label: 'Superior derecha' },
  { value: 'superior-izquierda', label: 'Superior izquierda' },
];

const FORMATS: { value: Format; label: string }[] = [
  { value: 'simple', label: '1' },
  { value: 'fraccion', label: '1 / N' },
  { value: 'pagina', label: 'Página 1 de N' },
];

const SELECT_CLASS =
  'flex h-10 w-full cursor-pointer rounded-lg border-3 border-ink bg-surface px-2.5 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm';

export default function PageNumberer() {
  const [position, setPosition] = useState<Position>('inferior-centro');
  const [format, setFormat] = useState<Format>('simple');
  const [startFrom, setStartFrom] = useState<number>(1);

  const batch = useBatchProcessor({
    accept: isPdf,
    process: (file, onProgress) => {
      const params: PageNumberParams = { position, format, startFrom };
      return numberPdf(file, params, onProgress);
    },
    outName: (f) => `${f.name.replace(/\.pdf$/i, '')}_numerado.pdf`,
    zipName: 'pdfs-numerados.zip',
    rejectMessage: 'Solo se aceptan archivos PDF',
  });

  const allFinished =
    batch.items.length > 0 &&
    batch.done &&
    batch.doneCount + batch.errorCount >= batch.items.length;

  const step: 1 | 2 | 3 =
    batch.items.length === 0 ? 1 : batch.doneCount > 0 ? 3 : 2;

  return (
    <ToolShell tool={tool} step={step}>
      <FileDropzone
        className="mb-4"
        accent={accent}
        accept=".pdf,application/pdf"
        multiple
        idleTitle="Selecciona archivos PDF"
        idleSubtitle="Haz clic o arrastra uno o varios PDF"
        dragTitle="Suelta los archivos aquí"
        buttonLabel="Seleccionar archivos"
        ariaLabel="Seleccionar o arrastrar archivos PDF"
        onFiles={batch.addFiles}
      />

      <ToolConstraints items={tool.constraints} />

      {batch.items.length > 0 && !allFinished && (
        <Card className="mb-8 motion-safe:animate-slide-up">
          <CardContent className="p-4 sm:p-6">
            <h2 className="mb-5 font-display text-lg font-bold text-ink">
              Ajustes de numeración
            </h2>
            <div className="grid gap-5 sm:grid-cols-3">
              <div>
                <Label htmlFor="pn-position" className="mb-2 block">
                  <Hash className="mr-2 inline h-4 w-4" />
                  Posición
                </Label>
                <select
                  id="pn-position"
                  value={position}
                  disabled={batch.isProcessing}
                  onChange={(e) => setPosition(e.target.value as Position)}
                  className={SELECT_CLASS}
                >
                  {POSITIONS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="pn-format" className="mb-2 block">
                  Formato
                </Label>
                <select
                  id="pn-format"
                  value={format}
                  disabled={batch.isProcessing}
                  onChange={(e) => setFormat(e.target.value as Format)}
                  className={SELECT_CLASS}
                >
                  {FORMATS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="pn-start" className="mb-2 block">
                  Empezar en la página
                </Label>
                <Input
                  id="pn-start"
                  type="number"
                  min={1}
                  value={startFrom}
                  disabled={batch.isProcessing}
                  onChange={(e) => setStartFrom(Number(e.target.value))}
                />
              </div>
            </div>

            <div className={cn('mt-5 rounded-lg border-3 border-ink p-3', accent.soft)}>
              <p className={cn('text-sm', accent.softText)}>
                El número se dibuja en azul marino a 20px del borde. Las páginas
                anteriores a la de inicio se quedan sin numerar. Los mismos ajustes
                se aplican a todos los archivos.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <BatchPanel
        items={batch.items}
        accent={accent}
        isProcessing={batch.isProcessing}
        done={batch.done}
        doneCount={batch.doneCount}
        errorCount={batch.errorCount}
        actionLabel="Numerar páginas"
        actioningLabel="Numerando…"
        ActionIcon={Hash}
        onRun={batch.run}
        onRemove={batch.removeItem}
        onReset={batch.reset}
        onDownloadAll={batch.downloadAll}
        onDownloadOne={batch.downloadOne}
        resultHint="Los números de página quedaron añadidos a tus PDF."
      />
    </ToolShell>
  );
}
