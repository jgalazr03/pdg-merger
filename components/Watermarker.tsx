'use client';

import { useState } from 'react';
import { Droplets } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { getTool } from '@/lib/tools';
import { useBatchProcessor } from '@/hooks/use-batch-processor';
import { watermarkPdf, type WatermarkParams } from '@/lib/watermark';
import ToolShell from '@/components/tools/ToolShell';
import FileDropzone from '@/components/tools/FileDropzone';
import ToolConstraints from '@/components/tools/ToolConstraints';
import BatchPanel from '@/components/tools/BatchPanel';

const tool = getTool('marca-de-agua');
const accent = tool.accent;

const isPdf = (f: File) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name);

type WmColorKey = 'gris' | 'navy' | 'rojo' | 'azul' | 'verde';

interface WmColor {
  key: WmColorKey;
  label: string;
  rgb: [number, number, number];
  css: string;
}

const WM_COLORS: WmColor[] = [
  { key: 'gris', label: 'Gris', rgb: [0.5, 0.5, 0.5], css: 'rgb(128,128,128)' },
  { key: 'navy', label: 'Navy', rgb: [0.09, 0.13, 0.24], css: 'rgb(23,33,61)' },
  { key: 'rojo', label: 'Rojo', rgb: [0.8, 0.1, 0.1], css: 'rgb(204,26,26)' },
  { key: 'azul', label: 'Azul', rgb: [0.1, 0.3, 0.8], css: 'rgb(26,77,204)' },
  { key: 'verde', label: 'Verde', rgb: [0.13, 0.5, 0.23], css: 'rgb(33,128,59)' },
];

export default function Watermarker() {
  const [text, setText] = useState('CONFIDENCIAL');
  const [opacity, setOpacity] = useState(30);
  const [rotation, setRotation] = useState(45);
  const [fontSize, setFontSize] = useState(50);
  const [colorKey, setColorKey] = useState<WmColorKey>('gris');
  const [pageRange, setPageRange] = useState('');

  const batch = useBatchProcessor({
    accept: isPdf,
    process: (file, onProgress) => {
      const color = WM_COLORS.find((c) => c.key === colorKey)!.rgb;
      const params: WatermarkParams = {
        text,
        opacity,
        rotation,
        fontSize,
        color,
        pageRange,
      };
      return watermarkPdf(file, params, onProgress);
    },
    outName: (f) => `${f.name.replace(/\.pdf$/i, '')}_marca-de-agua.pdf`,
    zipName: 'pdfs-marca-de-agua.zip',
    rejectMessage: 'Solo se aceptan archivos PDF',
  });

  const handleRun = () => {
    if (!text.trim()) {
      toast.error('Falta el texto', {
        description: 'Escribe el texto de la marca de agua.',
      });
      return;
    }
    batch.run();
  };

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
        loaded={step > 1}
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
              Ajustes de la marca de agua
            </h2>
            <div className="space-y-5">
              <div>
                <Label htmlFor="wm-text" className="mb-2 block">
                  <Droplets className="mr-2 inline h-4 w-4" />
                  Texto de la marca de agua
                </Label>
                <Input
                  id="wm-text"
                  type="text"
                  placeholder="CONFIDENCIAL"
                  value={text}
                  disabled={batch.isProcessing}
                  onChange={(e) => setText(e.target.value)}
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-3">
                <div>
                  <Label htmlFor="wm-opacity" className="mb-2 block">
                    Opacidad: {opacity}%
                  </Label>
                  <input
                    id="wm-opacity"
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={opacity}
                    disabled={batch.isProcessing}
                    onChange={(e) => setOpacity(Number(e.target.value))}
                    className={cn(
                      'h-2 w-full cursor-pointer appearance-none rounded-lg border-2 border-ink',
                      accent.soft
                    )}
                    aria-label="Opacidad de la marca de agua"
                  />
                </div>
                <div>
                  <Label htmlFor="wm-rotation" className="mb-2 block">
                    Rotación (°)
                  </Label>
                  <Input
                    id="wm-rotation"
                    type="number"
                    min={-360}
                    max={360}
                    value={rotation}
                    disabled={batch.isProcessing}
                    onChange={(e) => setRotation(Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="wm-size" className="mb-2 block">
                    Tamaño de fuente
                  </Label>
                  <Input
                    id="wm-size"
                    type="number"
                    min={6}
                    max={400}
                    value={fontSize}
                    disabled={batch.isProcessing}
                    onChange={(e) => setFontSize(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <Label className="mb-2 block">Color</Label>
                  <div className="flex flex-wrap gap-2">
                    {WM_COLORS.map((c) => (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => setColorKey(c.key)}
                        disabled={batch.isProcessing}
                        aria-label={`Color ${c.label}`}
                        aria-pressed={colorKey === c.key}
                        className={cn(
                          'flex items-center gap-2 rounded-lg border-3 px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50',
                          colorKey === c.key
                            ? 'border-ink bg-surface text-ink'
                            : 'border-transparent text-muted-foreground hover-fine:border-ink'
                        )}
                      >
                        <span
                          className="h-4 w-4 rounded-full border-2 border-ink"
                          style={{ backgroundColor: c.css }}
                        />
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label htmlFor="wm-range" className="mb-2 block">
                    Páginas
                  </Label>
                  <Input
                    id="wm-range"
                    type="text"
                    placeholder="Todas (ej. 1-3,5,8-10)"
                    value={pageRange}
                    disabled={batch.isProcessing}
                    onChange={(e) => setPageRange(e.target.value)}
                  />
                </div>
              </div>

              <div className={cn('rounded-lg border-3 border-ink p-3', accent.soft)}>
                <p className={cn('text-sm', accent.softText)}>
                  La marca se dibuja centrada y en diagonal. Deja «Páginas» en
                  blanco para aplicarla a todo el documento, o indica un rango como
                  «1-3,5,8-10». Los mismos ajustes se usan en todos los archivos.
                </p>
              </div>
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
        actionLabel="Añadir marca de agua"
        actioningLabel="Aplicando…"
        ActionIcon={Droplets}
        onRun={handleRun}
        onRemove={batch.removeItem}
        onReset={batch.reset}
        onDownloadAll={batch.downloadAll}
        onDownloadOne={batch.downloadOne}
        resultHint="La marca de agua quedó estampada en tus PDF."
      />
    </ToolShell>
  );
}
