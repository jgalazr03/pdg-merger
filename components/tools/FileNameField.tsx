'use client';

import { Edit3 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface FileNameFieldProps {
  /** id del input; también prefija el id del texto de ayuda (`${id}-help`). */
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Mensaje de error o `null` si el nombre es válido. */
  error: string | null;
  /** Nombre por defecto que se usará si se deja vacío (sin extensión). */
  placeholder: string;
  /** Extensión con punto, p. ej. ".pdf". Se muestra fija a la derecha. */
  extension: string;
  disabled?: boolean;
  /** Se llama al presionar Enter, solo si no hay error. */
  onSubmit?: () => void;
}

/**
 * Campo para nombrar el archivo final, reutilizable entre herramientas.
 * Réplica del campo de Unir: etiqueta con icono, sufijo de extensión fijo a
 * la derecha del input y texto de ayuda / error debajo.
 */
export default function FileNameField({
  id,
  label,
  value,
  onChange,
  error,
  placeholder,
  extension,
  disabled,
  onSubmit,
}: FileNameFieldProps) {
  const helpId = `${id}-help`;

  return (
    <div>
      <Label htmlFor={id} className="mb-2 block text-sm font-medium text-ink">
        <Edit3 className="mr-2 inline h-4 w-4" />
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !error && onSubmit) onSubmit();
          }}
          disabled={disabled}
          aria-invalid={!!error}
          aria-describedby={helpId}
          className={cn(
            'pr-12',
            error && 'border-brand-red focus-visible:ring-ink'
          )}
        />
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
          <span className="text-sm text-muted-foreground">{extension}</span>
        </div>
      </div>
      {error ? (
        <p className="mt-2 text-sm text-brand-red" id={helpId}>
          {error}
        </p>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground" id={helpId}>
          Si lo dejas vacío, se usará &quot;{placeholder}
          {extension}&quot;
        </p>
      )}
    </div>
  );
}
