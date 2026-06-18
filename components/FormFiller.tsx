'use client';

import { useState, useRef, useEffect } from 'react';
import {
  FileText,
  Download,
  Loader2,
  X,
  Check,
  FormInput,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn, scrollIntoViewSafe } from '@/lib/utils';
import { getTool } from '@/lib/tools';
import {
  listFields,
  fillForm,
  type FormField,
  type FieldValue,
} from '@/lib/pdf-forms';
import ToolShell from '@/components/tools/ToolShell';
import FileDropzone from '@/components/tools/FileDropzone';
import ToolConstraints from '@/components/tools/ToolConstraints';

const tool = getTool('rellenar-formularios');
const accent = tool.accent;

const SELECT_CLASS =
  'flex h-10 w-full cursor-pointer rounded-lg border-3 border-ink bg-surface px-2.5 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm';

interface ResultPDF {
  name: string;
  blob: Blob;
  applied: number;
  skipped: { name: string; reason: string }[];
}

function initialValues(fields: FormField[]): Record<string, FieldValue> {
  const values: Record<string, FieldValue> = {};
  for (const f of fields) {
    switch (f.type) {
      case 'text':
        values[f.name] = typeof f.value === 'string' ? f.value : '';
        break;
      case 'checkbox':
        values[f.name] = f.value === true;
        break;
      case 'dropdown':
      case 'radio':
        values[f.name] = Array.isArray(f.value)
          ? f.value[0] ?? ''
          : typeof f.value === 'string'
            ? f.value
            : '';
        break;
      case 'optionlist':
        values[f.name] = Array.isArray(f.value) ? [...f.value] : [];
        break;
    }
  }
  return values;
}

export default function FormFiller() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fields, setFields] = useState<FormField[] | null>(null);
  const [values, setValues] = useState<Record<string, FieldValue>>({});
  const [flatten, setFlatten] = useState(false);
  const [noFields, setNoFields] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ResultPDF | null>(null);
  const fieldsRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (fields && fields.length > 0) {
      setTimeout(() => scrollIntoViewSafe(fieldsRef.current), 100);
    }
  }, [fields]);

  useEffect(() => {
    if (result) {
      setTimeout(() => scrollIntoViewSafe(resultRef.current), 100);
    }
  }, [result]);

  const resetAll = () => {
    setSelectedFile(null);
    setFields(null);
    setValues({});
    setFlatten(false);
    setNoFields(false);
    setResult(null);
  };

  const handleFileSelect = async (file: File) => {
    if (!file) return;
    if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) {
      toast.error('Archivo no válido', {
        description: 'Por favor selecciona un archivo PDF.',
      });
      return;
    }

    resetAll();
    setSelectedFile(file);
    setIsLoading(true);
    try {
      const detected = await listFields(file);
      if (detected.length === 0) {
        setNoFields(true);
        setFields(null);
      } else {
        setFields(detected);
        setValues(initialValues(detected));
      }
    } catch (error) {
      console.error('Error leyendo el formulario:', error);
      toast.error('No se pudo leer el PDF', {
        description: 'Asegúrate de que sea un archivo válido.',
      });
      setSelectedFile(null);
    } finally {
      setIsLoading(false);
    }
  };

  const setValue = (name: string, value: FieldValue) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  const toggleOption = (name: string, option: string) => {
    setValues((prev) => {
      const current = Array.isArray(prev[name]) ? (prev[name] as string[]) : [];
      const next = current.includes(option)
        ? current.filter((o) => o !== option)
        : [...current, option];
      return { ...prev, [name]: next };
    });
  };

  const handleFill = async () => {
    if (!selectedFile) return;
    setIsProcessing(true);
    try {
      const { bytes, applied, skipped } = await fillForm(selectedFile, values, {
        flatten,
      });
      const blob = new Blob([bytes], { type: 'application/pdf' });
      setResult({
        name: `${selectedFile.name.replace(/\.pdf$/i, '')}_rellenado.pdf`,
        blob,
        applied: applied.length,
        skipped,
      });
      toast.success('Formulario rellenado', {
        description: `Se rellenaron ${applied.length} campo${applied.length !== 1 ? 's' : ''}.`,
      });
    } catch (error) {
      console.error('Error rellenando el formulario:', error);
      toast.error('No se pudo rellenar el formulario', {
        description: 'Inténtalo de nuevo.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadPDF = () => {
    if (!result) return;
    const url = URL.createObjectURL(result.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = result.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const step: 1 | 2 | 3 = !selectedFile ? 1 : result ? 3 : 2;

  return (
    <ToolShell tool={tool} step={step}>
      <FileDropzone
        className="mb-4"
        accent={accent}
        loaded={step > 1}
        accept=".pdf,application/pdf"
        idleTitle="Selecciona un archivo PDF"
        idleSubtitle="Haz clic aquí o arrastra y suelta tu PDF con formulario"
        dragTitle="Suelta el archivo PDF aquí"
        buttonLabel="Seleccionar archivo"
        ariaLabel="Seleccionar o arrastrar un archivo PDF"
        onFiles={(files) => handleFileSelect(files[0])}
      />

      <ToolConstraints items={tool.constraints} />

      {isLoading && (
        <Card className="mb-8">
          <CardContent className="flex flex-col items-center py-16 text-center">
            <Loader2 className={cn('h-8 w-8 animate-spin', accent.text)} />
            <p className="mt-4 text-muted-foreground">Detectando campos…</p>
          </CardContent>
        </Card>
      )}

      {noFields && !isLoading && (
        <Card className="mb-8 motion-safe:animate-slide-up">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-6 w-6 shrink-0 text-destructive" />
                <h2 className="font-display text-lg font-bold text-ink">
                  Este PDF no tiene campos de formulario
                </h2>
              </div>
              <Button variant="outline" size="sm" onClick={resetAll} className="shrink-0">
                <X className="mr-2 h-4 w-4" />
                Cambiar archivo
              </Button>
            </div>
            <p className="mt-3 text-muted-foreground">
              No se detectó ningún campo AcroForm rellenable. Es posible que el
              documento no sea un formulario, que sus campos estén aplanados, o
              que use el formato XFA de Adobe LiveCycle (no compatible).
            </p>
          </CardContent>
        </Card>
      )}

      {fields && fields.length > 0 && !result && (
        <Card ref={fieldsRef} className="mb-8 motion-safe:animate-slide-up">
          <CardContent className="p-4 sm:p-6">
            <div className="mb-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="font-display text-lg font-bold text-ink">
                {fields.length} campo{fields.length !== 1 ? 's' : ''} detectado
                {fields.length !== 1 ? 's' : ''}
              </h2>
              <Button
                variant="outline"
                size="sm"
                onClick={resetAll}
                disabled={isProcessing}
                className="shrink-0"
              >
                <X className="mr-2 h-4 w-4" />
                Cambiar archivo
              </Button>
            </div>

            {selectedFile && (
              <div className="mb-6 flex items-center gap-4 rounded-lg border-3 border-ink bg-surface p-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded border-2 border-ink bg-card">
                  <FileText className="h-6 w-6 text-ink" />
                </div>
                <p className="min-w-0 flex-1 truncate font-medium text-ink">
                  {selectedFile.name}
                </p>
              </div>
            )}

            <div className="space-y-5">
              {fields.map((f) => (
                <div key={f.name}>
                  <Label htmlFor={`ff-${f.name}`} className="mb-2 block break-words">
                    {f.name}
                  </Label>

                  {f.type === 'text' && (
                    <Input
                      id={`ff-${f.name}`}
                      type="text"
                      value={(values[f.name] as string) ?? ''}
                      disabled={isProcessing}
                      onChange={(e) => setValue(f.name, e.target.value)}
                    />
                  )}

                  {f.type === 'checkbox' && (
                    <button
                      id={`ff-${f.name}`}
                      type="button"
                      role="checkbox"
                      aria-checked={values[f.name] === true}
                      disabled={isProcessing}
                      onClick={() => setValue(f.name, values[f.name] !== true)}
                      className={cn(
                        'flex items-center gap-3 rounded-lg border-3 border-ink px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50',
                        values[f.name] === true ? accent.soft : 'bg-surface'
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-6 w-6 items-center justify-center rounded border-2 border-ink',
                          values[f.name] === true ? accent.solid : 'bg-card'
                        )}
                      >
                        {values[f.name] === true && (
                          <Check className="h-4 w-4" strokeWidth={3} />
                        )}
                      </span>
                      {values[f.name] === true ? 'Activado' : 'Desactivado'}
                    </button>
                  )}

                  {(f.type === 'dropdown' || f.type === 'radio') && (
                    <select
                      id={`ff-${f.name}`}
                      value={(values[f.name] as string) ?? ''}
                      disabled={isProcessing}
                      onChange={(e) => setValue(f.name, e.target.value)}
                      className={SELECT_CLASS}
                    >
                      <option value="">— Sin selección —</option>
                      {(f.options ?? []).map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  )}

                  {f.type === 'optionlist' && (
                    <div className="flex flex-wrap gap-2">
                      {(f.options ?? []).map((opt) => {
                        const selected =
                          Array.isArray(values[f.name]) &&
                          (values[f.name] as string[]).includes(opt);
                        return (
                          <button
                            key={opt}
                            type="button"
                            aria-pressed={selected}
                            disabled={isProcessing}
                            onClick={() => toggleOption(f.name, opt)}
                            className={cn(
                              'flex items-center gap-2 rounded-lg border-3 px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50',
                              selected
                                ? cn('border-ink', accent.soft)
                                : 'border-transparent bg-surface text-muted-foreground hover-fine:border-ink'
                            )}
                          >
                            {selected && <Check className="h-4 w-4" strokeWidth={3} />}
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <label className="mt-6 flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={flatten}
                disabled={isProcessing}
                onChange={(e) => setFlatten(e.target.checked)}
                className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-ink"
              />
              <span className="text-sm text-ink">
                Aplanar al terminar (el formulario queda fijo y ya no se puede
                editar).
              </span>
            </label>

            <div className={cn('mt-5 rounded-lg border-3 border-ink p-3', accent.soft)}>
              <p className={cn('text-sm', accent.softText)}>
                Para acentos y caracteres fuera del alfabeto latino básico, algún
                campo podría omitirse. Te diremos cuáles al terminar.
              </p>
            </div>

            <div className="mt-6 text-center">
              <Button
                onClick={handleFill}
                disabled={isProcessing}
                aria-busy={isProcessing}
                size="lg"
                className={accent.solid}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Generando…
                  </>
                ) : (
                  <>
                    <FormInput className="mr-2 h-5 w-5" />
                    Generar PDF
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card ref={resultRef} className="motion-safe:animate-slide-up">
          <CardContent className="p-4 sm:p-6">
            <div className="mb-6 text-center">
              <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full border-3 border-ink bg-success text-white">
                <Download className="h-8 w-8" />
              </div>
              <h2 className="mb-2 text-lg font-bold text-success">
                ¡Formulario rellenado!
              </h2>
              <p className="mb-1 text-ink">
                Se rellenaron {result.applied} campo
                {result.applied !== 1 ? 's' : ''}
                {flatten ? ' y el PDF quedó aplanado' : ''}.
              </p>
              {result.skipped.length > 0 && (
                <p className="mb-3 text-sm text-muted-foreground">
                  {result.skipped.length} campo
                  {result.skipped.length !== 1 ? 's se omitieron' : ' se omitió'}{' '}
                  ({result.skipped.map((s) => s.name).join(', ')}).
                </p>
              )}
              <div className="mt-3">
                <Button onClick={downloadPDF} size="lg" className={accent.solid}>
                  <Download className="mr-2 h-5 w-5" />
                  Descargar PDF
                </Button>
              </div>
            </div>

            <div className="mt-6 text-center">
              <Button variant="outline" onClick={resetAll} size="lg">
                Rellenar otro PDF
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </ToolShell>
  );
}
