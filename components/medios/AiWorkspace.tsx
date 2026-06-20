'use client';

import { useState } from 'react';
import {
  Sparkles,
  ListTree,
  MessageCircleQuestion,
  FileText,
  Languages,
  BarChart3,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ToolAccent } from '@/lib/tools';
import type { Chunk, SpeakerNames } from '@/lib/transcript';
import ErrorBoundary from '@/components/ErrorBoundary';
import AskPanel from './AskPanel';
import SummaryPanel from './SummaryPanel';
import AnalysisPanel from './AnalysisPanel';
import ChaptersPanel from './ChaptersPanel';
import DeliverablePanel from './DeliverablePanel';
import TranslatePanel from './TranslatePanel';

export type WorkspaceTab =
  | 'preguntar'
  | 'resumen'
  | 'analisis'
  | 'capitulos'
  | 'documento'
  | 'traducir';

type Props = {
  chunks: Chunk[];
  text: string;
  accent: ToolAccent;
  baseName: string;
  /** Nombres personalizados de los hablantes (se propagan a cada panel). */
  names?: SpeakerNames;
  onSeek: (time: number) => void;
  /** Pestaña activa al montar (la herramienta "Analizar" abre en "analisis"). */
  defaultTab?: WorkspaceTab;
  /** 'contable' habilita las plantillas verticales del despacho en Documento. */
  variant?: 'general' | 'contable';
};

const TABS: { key: WorkspaceTab; label: string; icon: LucideIcon }[] = [
  { key: 'preguntar', label: 'Preguntar', icon: MessageCircleQuestion },
  { key: 'resumen', label: 'Resumen', icon: Sparkles },
  { key: 'analisis', label: 'Análisis', icon: BarChart3 },
  { key: 'capitulos', label: 'Capítulos', icon: ListTree },
  { key: 'documento', label: 'Documento', icon: FileText },
  { key: 'traducir', label: 'Traducir', icon: Languages },
];

/**
 * Workspace de herramientas AI sobre la grabación. Una sola superficie con
 * pestañas (no una pila de cards idénticas): aprovecha el ancho en desktop al
 * ir junto al reproductor. Los paneles se mantienen montados y se ocultan los
 * inactivos, así no pierden su estado (resumen generado, hilo de chat, etc.).
 */
export default function AiWorkspace({
  chunks,
  text,
  accent,
  baseName,
  names,
  onSeek,
  defaultTab = 'preguntar',
  variant = 'general',
}: Props) {
  const [active, setActive] = useState<WorkspaceTab>(defaultTab);

  return (
    <div className="overflow-hidden rounded-lg border-3 border-ink bg-card">
      <div
        role="tablist"
        aria-label="Herramientas de la grabación"
        className="flex gap-1 overflow-x-auto border-b-3 border-ink bg-surface p-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {TABS.map((t) => {
          const isActive = active === t.key;
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(t.key)}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-md border-2 px-2.5 py-1.5 text-xs font-bold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink',
                isActive
                  ? cn(accent.solid, 'border-ink')
                  : 'border-transparent text-ink hover-fine:bg-muted'
              )}
            >
              <Icon className="h-4 w-4" strokeWidth={2.5} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Cada panel queda aislado: si uno revienta en render, su error boundary
          lo contiene (no tumba el workspace ni la página) y la transcripción
          —que vive en el estado del padre— se preserva. */}
      <div className={cn(active !== 'preguntar' && 'hidden')}>
        <ErrorBoundary label="el panel de preguntas">
          <AskPanel chunks={chunks} accent={accent} names={names} onSeek={onSeek} />
        </ErrorBoundary>
      </div>
      <div className={cn(active !== 'resumen' && 'hidden')}>
        <ErrorBoundary label="el resumen">
          <SummaryPanel text={text} accent={accent} baseName={baseName} />
        </ErrorBoundary>
      </div>
      <div className={cn(active !== 'analisis' && 'hidden')}>
        <ErrorBoundary label="el análisis">
          <AnalysisPanel chunks={chunks} text={text} accent={accent} baseName={baseName} names={names} onSeek={onSeek} />
        </ErrorBoundary>
      </div>
      <div className={cn(active !== 'capitulos' && 'hidden')}>
        <ErrorBoundary label="los capítulos">
          <ChaptersPanel chunks={chunks} accent={accent} names={names} onSeek={onSeek} />
        </ErrorBoundary>
      </div>
      <div className={cn(active !== 'documento' && 'hidden')}>
        <ErrorBoundary label="el documento">
          <DeliverablePanel chunks={chunks} accent={accent} baseName={baseName} names={names} variant={variant} />
        </ErrorBoundary>
      </div>
      <div className={cn(active !== 'traducir' && 'hidden')}>
        <ErrorBoundary label="la traducción">
          <TranslatePanel chunks={chunks} accent={accent} baseName={baseName} />
        </ErrorBoundary>
      </div>
    </div>
  );
}
