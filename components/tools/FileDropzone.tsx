'use client';

import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
}

/**
 * Zona de carga reutilizable y accesible (clic, arrastrar y soltar, y teclado).
 * Centraliza el patrón que antes estaba duplicado en cada herramienta.
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
        'cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition-all sm:p-12',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        accent.ring,
        isDragOver
          ? cn(accent.border, accent.soft, 'motion-safe:scale-[1.02]')
          : cn('border-gray-300', accent.borderHover)
      )}
    >
      <Upload
        className={cn(
          'mx-auto mb-4 h-12 w-12 transition-colors',
          isDragOver ? accent.text : 'text-gray-400'
        )}
      />
      <h3
        className={cn(
          'mb-2 text-lg font-semibold transition-colors',
          isDragOver ? 'text-gray-900' : 'text-gray-900'
        )}
      >
        {isDragOver ? dragTitle : idleTitle}
      </h3>
      <p className="mx-auto mb-6 max-w-md text-gray-600">{idleSubtitle}</p>
      {!isDragOver && (
        <Button type="button" className={accent.solid} tabIndex={-1}>
          <Upload className="mr-2 h-4 w-4" />
          {buttonLabel}
        </Button>
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
