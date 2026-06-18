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
  /**
   * Ya hay recurso(s) cargado(s): el dropzone grande se hace a un lado. En
   * archivo único se oculta (la tarjeta del recurso ofrece "Cambiar archivo");
   * en varios archivos colapsa a una barra delgada para seguir agregando.
   */
  loaded?: boolean;
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
  loaded = false,
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

  // Recurso(s) ya cargado(s). En archivo único el dropzone grande sobra; en
  // varios archivos lo reducimos a una barra delgada para seguir agregando.
  if (loaded) {
    if (!multiple) return null;
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
          'group flex cursor-pointer items-center justify-center gap-2 rounded-lg border-[3px] border-dashed border-ink px-4 py-3 text-sm font-bold text-ink transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2',
          isDragOver ? 'bg-highlight-soft' : 'bg-surface hover-fine:bg-muted',
          className
        )}
      >
        <Upload className="h-4 w-4 shrink-0" strokeWidth={2} />
        <span>{isDragOver ? dragTitle : 'Agregar más archivos'}</span>
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
        // Una sola caja: borde navy discontinuo 3px, papel, color plano, sin sombra.
        // Columna flex centrada para que el botón pueda fijarse abajo (mt-auto):
        // así, en layouts lado a lado (p. ej. dos zonas A/B), los botones quedan
        // alineados aunque el subtítulo tenga 1 o 2 renglones. En uso individual
        // no hay altura extra, así que mt-auto = 0 y el layout no cambia.
        'group relative flex cursor-pointer flex-col items-center rounded-lg border-[3px] border-dashed border-ink px-5 py-7 text-center transition-colors duration-150 ease-out sm:px-6 sm:py-12',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2',
        isDragOver ? 'bg-highlight-soft' : 'bg-surface hover-fine:bg-muted',
        className
      )}
    >
      <div
        className={cn(
          'mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg border-3 border-ink transition-colors sm:mb-5 sm:h-14 sm:w-14',
          isDragOver ? 'bg-highlight text-white' : 'bg-surface text-ink'
        )}
      >
        <Upload className="h-6 w-6" strokeWidth={2} />
      </div>
      <h3 className="mb-1.5 text-lg font-bold text-ink">
        {isDragOver ? dragTitle : idleTitle}
      </h3>
      <p className="mx-auto mb-5 max-w-md text-sm text-muted-foreground sm:mb-6">
        {idleSubtitle}
      </p>
      {!isDragOver && (
        <span
          aria-hidden="true"
          className={cn(buttonVariants({ size: 'lg' }), 'mt-auto', accent.solid)}
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
