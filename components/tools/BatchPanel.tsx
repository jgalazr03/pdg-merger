'use client';

import { FileText, Loader2, X, Check, AlertCircle, Download } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { ToolAccent } from '@/lib/tools';
import type { BatchItem } from '@/hooks/use-batch-processor';

function formatSize(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

interface BatchPanelProps {
  items: BatchItem[];
  accent: ToolAccent;
  isProcessing: boolean;
  done: boolean;
  doneCount: number;
  errorCount: number;
  actionLabel: string;
  actioningLabel: string;
  ActionIcon: LucideIcon;
  onRun: () => void;
  onRemove: (id: string) => void;
  onReset: () => void;
  onDownloadAll: () => void;
  onDownloadOne: (id: string) => void;
  resultHint?: string;
}

/**
 * Panel reutilizable para herramientas por lotes: lista de archivos con estado
 * por archivo, botón de acción y bloque de resultado (descarga individual o en
 * .zip). El estado lo aporta `useBatchProcessor`.
 */
export default function BatchPanel({
  items,
  accent,
  isProcessing,
  done,
  doneCount,
  errorCount,
  actionLabel,
  actioningLabel,
  ActionIcon,
  onRun,
  onRemove,
  onReset,
  onDownloadAll,
  onDownloadOne,
  resultHint,
}: BatchPanelProps) {
  if (items.length === 0) return null;
  const finished = done && doneCount > 0 && doneCount + errorCount >= items.length;

  return (
    <Card className="mb-8 motion-safe:animate-slide-up">
      <CardContent className="p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold text-ink">
            {items.length} archivo{items.length !== 1 ? 's' : ''}
            {doneCount > 0 && (
              <span className="text-success">
                {' '}
                · {doneCount} listo{doneCount !== 1 ? 's' : ''}
              </span>
            )}
            {errorCount > 0 && (
              <span className="text-destructive"> · {errorCount} con error</span>
            )}
          </h2>
          {!isProcessing && (
            <Button variant="outline" size="sm" onClick={onReset} className="shrink-0">
              <X className="mr-2 h-4 w-4" />
              Quitar todos
            </Button>
          )}
        </div>

        <ul className="space-y-2">
          {items.map((it) => (
            <li
              key={it.id}
              className="flex items-center gap-3 rounded-lg border-3 border-ink bg-surface p-3"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded border-2 border-ink bg-card">
                <FileText className="h-5 w-5 text-ink" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink">{it.file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {it.status === 'error' ? (
                    <span className="text-destructive">
                      {it.error || 'No se pudo procesar'}
                    </span>
                  ) : (
                    formatSize(it.file.size)
                  )}
                </p>
              </div>

              {it.status === 'processing' && (
                <span className="flex items-center gap-1.5 text-sm font-bold tabular-nums">
                  <Loader2 className={cn('h-5 w-5 animate-spin', accent.text)} />
                  {typeof it.progress === 'number' && it.progress > 0 && (
                    <span className={accent.text}>{it.progress}%</span>
                  )}
                </span>
              )}
              {it.status === 'done' && (
                <button
                  type="button"
                  onClick={() => onDownloadOne(it.id)}
                  aria-label={`Descargar ${it.outName ?? it.file.name}`}
                  className={cn(
                    'rounded p-1.5 transition-colors hover-fine:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink',
                    accent.text
                  )}
                >
                  <Download className="h-5 w-5" />
                </button>
              )}
              {it.status === 'error' && (
                <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
              )}
              {it.status === 'pending' && !isProcessing && (
                <button
                  type="button"
                  onClick={() => onRemove(it.id)}
                  aria-label={`Quitar ${it.file.name}`}
                  className="rounded p-1.5 text-muted-foreground transition-colors hover-fine:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>

        {!finished ? (
          <div className="mt-6">
            <Button
              onClick={onRun}
              disabled={isProcessing || items.length === 0}
              aria-busy={isProcessing}
              size="lg"
              className={accent.solid}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  {actioningLabel}
                </>
              ) : (
                <>
                  <ActionIcon className="mr-2 h-5 w-5" />
                  {actionLabel}
                  {items.length > 1 ? ` (${items.length})` : ''}
                </>
              )}
            </Button>
          </div>
        ) : (
          <div
            className={cn(
              'mt-6 rounded-lg border-3 border-ink p-4 text-center',
              accent.soft
            )}
          >
            <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full border-3 border-ink bg-success text-white">
              <Check className="h-6 w-6" strokeWidth={3} />
            </div>
            <p className="mb-1 font-bold text-success">
              {doneCount} archivo{doneCount !== 1 ? 's' : ''} listo
              {doneCount !== 1 ? 's' : ''}
              {errorCount > 0 ? `, ${errorCount} con error` : ''}
            </p>
            {resultHint && (
              <p className={cn('mb-4 text-sm', accent.softText)}>{resultHint}</p>
            )}
            <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
              <Button onClick={onDownloadAll} size="lg" className={accent.solid}>
                <Download className="mr-2 h-5 w-5" />
                {doneCount > 1 ? 'Descargar todo (.zip)' : 'Descargar'}
              </Button>
              <Button variant="outline" onClick={onReset} size="lg">
                Empezar de nuevo
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
