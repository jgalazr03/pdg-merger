'use client';

import { useState } from 'react';
import { Upload, Settings2, Trash2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import StepIndicator from '@/components/tools/StepIndicator';
import FileDropzone from '@/components/tools/FileDropzone';
import { getTool } from '@/lib/tools';

/**
 * Pantalla de muestra del sistema visual neo-brutalista (handoff
 * "react-spring-visualizer") adaptado a la marca GAINCO. No es una ruta de
 * producto: documenta el lenguaje aplicado a los componentes reales.
 */

const ROLES: { name: string; role: string; hex: string; swatch: string; ring?: boolean }[] = [
  { name: 'bg', role: 'Fondo de página', hex: '#fcfaf7', swatch: 'bg-surface' },
  { name: 'surface', role: 'Paneles / tarjetas', hex: '#f3ead9', swatch: 'bg-card' },
  { name: 'ink', role: 'Texto + TODOS los bordes', hex: '#000044', swatch: 'bg-ink' },
  { name: 'accent', role: 'Links / acción / activo', hex: '#004b7d', swatch: 'bg-brand-ocean' },
  { name: 'muted', role: 'Texto secundario', hex: '#5a647c', swatch: 'bg-[#5a647c]' },
  { name: 'highlight', role: 'Relleno de acento', hex: '#0d9488', swatch: 'bg-highlight' },
  { name: 'destructive', role: 'Destructivo / errores', hex: '#c60014', swatch: 'bg-brand-red' },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="mb-1 text-2xl font-bold text-ink">{title}</h2>
      <span aria-hidden="true" className="mb-6 block h-1 w-12 bg-brand-red" />
      {children}
    </section>
  );
}

export default function EstiloPage() {
  const [quality, setQuality] = useState([60]);
  const [progress] = useState(45);
  const [checked, setChecked] = useState(true);
  const tool = getTool('unir');

  return (
    <div className="container mx-auto max-w-5xl px-4 py-14">
      <p className="mb-4 inline-flex items-center gap-2 rounded border-2 border-ink bg-card px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand-ocean">
        <span className="h-1.5 w-1.5 rounded-full bg-brand-red" />
        Sistema visual · GAINCO
      </p>
      <h1 className="text-4xl font-bold leading-[1.05] tracking-tight text-ink sm:text-5xl">
        Lenguaje neo-brutalista
      </h1>
      <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
        Una sola tipografía monoespaciada, bloques de color plano, bordes navy
        gruesos y radius de 5px. Sin sombras, sin degradados. La marca GAINCO con
        los roles del sistema base.
      </p>

      {/* ---- Color (rol → hex) ---- */}
      <Section title="Color (rol → hex)">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {ROLES.map((r) => (
            <div key={r.name} className="rounded-lg border-3 border-ink bg-card p-3">
              <div className={`mb-3 h-16 rounded border-3 border-ink ${r.swatch}`} />
              <p className="text-sm font-bold text-ink">{r.name}</p>
              <p className="text-xs text-muted-foreground">{r.role}</p>
              <p className="mt-1 text-xs font-medium text-ink">{r.hex}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ---- Tipografía ---- */}
      <Section title="Tipografía — Roboto Mono">
        <div className="ds-panel space-y-3 p-6">
          <p className="text-5xl font-bold text-ink">H1 · Aa Bb 0123</p>
          <p className="text-2xl font-bold text-ink">H2 · Sección</p>
          <p className="text-lg font-bold text-ink">H3 · Subsección</p>
          <p className="text-xs font-bold uppercase tracking-wider text-brand-ocean">
            Label · etiqueta auxiliar
          </p>
          <p className="max-w-2xl text-base leading-relaxed text-ink">
            Cuerpo — jerarquía solo por tamaño, peso y color, nunca mezclando
            familias. Las cifras tabulares 0123456789 quedan alineadas.
          </p>
          <p className="text-sm text-muted-foreground">
            Aux — texto secundario en pizarra apagada.
          </p>
        </div>
      </Section>

      {/* ---- Botones ---- */}
      <Section title="Botones">
        <div className="ds-panel flex flex-wrap items-center gap-4 p-6">
          <Button className={tool.accent.solid}>Acción primaria</Button>
          <Button variant="outline">Secundario</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">
            <Trash2 className="mr-2 h-4 w-4" />
            Eliminar
          </Button>
          <Button size="icon" aria-label="Ajustes">
            <Settings2 className="h-5 w-5" />
          </Button>
          <Button disabled>Deshabilitado</Button>
          <Button className={tool.accent.solid}>
            Continuar
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </Section>

      {/* ---- Formularios ---- */}
      <Section title="Campos y controles">
        <div className="ds-panel grid grid-cols-1 gap-6 p-6 md:grid-cols-2">
          <div>
            <Label htmlFor="demo-name" className="mb-2 block">
              Nombre del archivo
            </Label>
            <Input id="demo-name" placeholder="documento_final" />
          </div>

          <div>
            <Label htmlFor="demo-format" className="mb-2 block">
              Formato de salida
            </Label>
            <Select defaultValue="pdf">
              <SelectTrigger id="demo-format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pdf">PDF</SelectItem>
                <SelectItem value="xlsx">Excel (.xlsx)</SelectItem>
                <SelectItem value="png">Imagen (.png)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="mb-2 block">Calidad: {quality[0]}%</Label>
            <Slider value={quality} onValueChange={setQuality} max={100} step={5} />
          </div>

          <div>
            <Label className="mb-2 block">Progreso de ejemplo</Label>
            <Progress value={progress} />
          </div>

          <label className="flex cursor-pointer items-center gap-3 text-sm font-medium text-ink">
            <Checkbox
              checked={checked}
              onCheckedChange={(v) => setChecked(v === true)}
            />
            Conservar archivos originales
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <Badge>Activo</Badge>
            <Badge variant="secondary">Highlight</Badge>
            <Badge variant="outline">Neutro</Badge>
            <Badge variant="destructive">Error</Badge>
          </div>
        </div>
      </Section>

      {/* ---- Indicador de pasos ---- */}
      <Section title="Indicador de pasos">
        <div className="ds-panel px-6 pb-2 pt-6">
          <StepIndicator current={2} accent={tool.accent} />
        </div>
      </Section>

      {/* ---- Zona de carga ---- */}
      <Section title="Zona de carga">
        <FileDropzone
          accent={tool.accent}
          accept=".pdf"
          idleTitle="Selecciona o arrastra tus archivos"
          idleSubtitle="Una sola caja, borde navy discontinuo y CTA de marca."
          dragTitle="Suelta aquí"
          buttonLabel="Seleccionar archivos"
          ariaLabel="Zona de carga de ejemplo"
          onFiles={() => toast.success('Demostración: archivo recibido')}
        />
      </Section>

      {/* ---- Notificación ---- */}
      <Section title="Notificaciones">
        <div className="ds-panel flex flex-wrap gap-4 p-6">
          <Button onClick={() => toast.success('¡Listo! Proceso completado')}>
            <Upload className="mr-2 h-4 w-4" />
            Toast de éxito
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              toast.error('No se pudo procesar', {
                description: 'Revisa los archivos e inténtalo de nuevo.',
              })
            }
          >
            Toast de error
          </Button>
        </div>
      </Section>
    </div>
  );
}
