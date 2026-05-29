'use client';

import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { ToolAccent } from '@/lib/tools';
import { cn } from '@/lib/utils';

interface FileDropzoneProps {
  /** Valor del atributo accept del input. */
  accept: string;
  multiple?: boolean;
  accent: ToolAccent;
  /** Título en estado inactivo. */
  idleTitle: string;
  /** Subtítulo en estado inactivo. */
  idleSubtitle: string;
  /** Título mientras se arrastra. */
  dragTitle: string;
  buttonLabel: string;
  /** Etiqueta accesible de la zona. */
  ariaLabel: string;
  onFiles: (files: FileList) => void;
  className?: string;
}

/**
 * Zona de carga reutilizable y accesible (clic, arrastrar y soltar, y teclado).
 * Una sola caja con profundidad — sin doble borde — y acento rojo de marca al
 * interactuar.
 */
export default function FileDropzone({
  accept,
  multiple = false,
  accent,
  idleTitle,
  idleSubtitle,
  dragTitle,
  buttonLabel,
  ariaLabel,
  onFiles,
  className,
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const open = () => inputRef.current?.click();

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      open();
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      onFiles(e.dataTransfer.files);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      onClick={open}
      onKeyDown={handleKeyDown}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={cn(
        'group relative cursor-pointer rounded-2xl border-2 border-dashed bg-white px-6 py-10 text-center shadow-sm transition duration-200 ease-out-quint sm:py-12',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red focus-visible:ring-offset-2',
        isDragOver
          ? 'border-brand-red bg-brand-red/[0.03] shadow-md motion-safe:scale-[1.01]'
          : 'border-border hover:border-brand-red/40 hover:shadow-md',
        className
      )}
    >
      <div
        className={cn(
          'mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl transition-colors',
          isDragOver ? 'bg-brand-red/10' : 'bg-brand-navy/[0.04] group-hover:bg-brand-navy/[0.07]'
        )}
      >
        <Upload
          className={cn(
            'h-6 w-6 transition-colors',
            isDragOver ? 'text-brand-red' : 'text-brand-navy/70'
          )}
          strokeWidth={1.75}
        />
      </div>
      <h3 className="mb-1.5 font-display text-lg font-bold text-brand-navy">
        {isDragOver ? dragTitle : idleTitle}
      </h3>
      <p className="mx-auto mb-6 max-w-md text-sm text-muted-foreground">
        {idleSubtitle}
      </p>
      {!isDragOver && (
        <span
          aria-hidden="true"
          className={cn(buttonVariants({ size: 'lg' }), accent.solid)}
        >
          <Upload className="mr-2 h-4 w-4" />
          {buttonLabel}
        </span>
      )}
      <input
        ref={inputRef}
        type="file"
        multiple={multiple}
        accept={accept}
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            onFiles(e.target.files);
          }
        }}
      />
    </div>
  );
}
