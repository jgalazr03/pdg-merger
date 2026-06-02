'use client';

import { useState, useRef, useEffect } from 'react';
import { PDFDocument } from 'pdf-lib';
import {
  FileText,
  Download,
  Loader2,
  X,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn, scrollIntoViewSafe } from '@/lib/utils';
import { toastUndo } from '@/lib/toast';
import { getTool } from '@/lib/tools';
import { protectPdf, unlockPdf, WrongPasswordError } from '@/lib/qpdf';
import ToolShell from '@/components/tools/ToolShell';
import FileDropzone from '@/components/tools/FileDropzone';
import ToolConstraints from '@/components/tools/ToolConstraints';

const tool = getTool('contrasena-pdf');
const accent = tool.accent;

type Mode = 'proteger' | 'quitar';

export default function PDFPassword() {
  const [mode, setMode] = useState<Mode>('proteger');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isEncrypted, setIsEncrypted] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const fileInfoRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedFile && fileInfoRef.current) {
      setTimeout(() => scrollIntoViewSafe(fileInfoRef.current), 100);
    }
  }, [selectedFile]);

  useEffect(() => {
    if (resultBlob) {
      setTimeout(() => scrollIntoViewSafe(resultRef.current), 100);
    }
  }, [resultBlob]);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const resetInputs = () => {
    setPassword('');
    setConfirm('');
    setShowPassword(false);
    setResultBlob(null);
  };

  const handleFileSelect = async (file: File) => {
    if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) {
      toast.error('Archivo no válido', {
        description: 'Por favor selecciona un archivo PDF.',
      });
      return;
    }
    setSelectedFile(file);
    resetInputs();
    setIsEncrypted(null);

    // Detección suave (solo para guiar al usuario): pdf-lib lanza un error de
    // cifrado al cargar un PDF protegido. No bloquea ninguna acción.
    try {
      const buf = await file.arrayBuffer();
      await PDFDocument.load(buf);
      setIsEncrypted(false);
    } catch (err) {
      setIsEncrypted(/encrypt/i.test(String((err as Error)?.message)));
    }
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setPassword('');
    setConfirm('');
    setResultBlob(null);
  };

  const runOperation = async () => {
    if (!selectedFile || !password) {
      if (!password) toast.error('Escribe una contraseña');
      return;
    }
    if (mode === 'proteger' && password !== confirm) {
      toast.error('Las contraseñas no coinciden');
      return;
    }
    setIsProcessing(true);
    try {
      const blob =
        mode === 'proteger'
          ? await protectPdf(selectedFile, password)
          : await unlockPdf(selectedFile, password);
      setResultBlob(blob);
      toast.success(
        mode === 'proteger'
          ? 'PDF protegido con contraseña'
          : 'Contraseña eliminada'
      );
    } catch (err) {
      if (err instanceof WrongPasswordError) {
        toast.error('Contraseña incorrecta', {
          description: 'No pudimos abrir el PDF con esa contraseña.',
        });
      } else {
        console.error('Error en herramienta de contraseña:', err);
        toast.error(
          mode === 'proteger'
            ? 'No se pudo proteger el PDF'
            : 'No se pudo quitar la contraseña',
          { description: 'Inténtalo de nuevo.' }
        );
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadResult = () => {
    if (!resultBlob || !selectedFile) return;
    const url = URL.createObjectURL(resultBlob);
    const base = selectedFile.name.replace(/\.pdf$/i, '');
    const suffix = mode === 'proteger' ? '_protegido' : '_sin-contrasena';
    const link = document.createElement('a');
    link.href = url;
    link.download = `${base}${suffix}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const resetAll = () => {
    setSelectedFile(null);
    setIsEncrypted(null);
    resetInputs();
  };

  const changeFileWithUndo = () => {
    if (!selectedFile) return;
    const snap = { selectedFile, isEncrypted };
    resetAll();
    toastUndo('Archivo descartado', {
      description: 'Selecciona otro PDF, o recupéralo si fue un error.',
      onUndo: () => {
        setSelectedFile(snap.selectedFile);
        setIsEncrypted(snap.isEncrypted);
      },
    });
  };

  const step: 1 | 2 | 3 = !selectedFile ? 1 : resultBlob ? 3 : 2;
  const verb = mode === 'proteger' ? 'Proteger PDF' : 'Quitar contraseña';
  const canSubmit =
    !isProcessing &&
    !!password &&
    (mode === 'quitar' || password === confirm);

  return (
    <ToolShell tool={tool} step={step}>
      {/* Selector de modo */}
      <div
        role="tablist"
        aria-label="Qué quieres hacer"
        className="mb-4 grid grid-cols-2 gap-2 rounded-lg border-3 border-ink bg-surface p-1.5"
      >
        {(['proteger', 'quitar'] as Mode[]).map((m) => {
          const active = mode === m;
          const Icon = m === 'proteger' ? Lock : Unlock;
          return (
            <button
              key={m}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={() => switchMode(m)}
              className={cn(
                'flex items-center justify-center gap-2 rounded-md border-3 px-3 py-2.5 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2',
                active
                  ? cn(accent.solid, 'border-ink')
                  : 'border-transparent text-ink hover-fine:bg-muted'
              )}
            >
              <Icon className="h-4 w-4" strokeWidth={2} />
              {m === 'proteger' ? 'Proteger' : 'Quitar contraseña'}
            </button>
          );
        })}
      </div>

      <FileDropzone
        className="mb-4"
        accent={accent}
        accept=".pdf,application/pdf"
        idleTitle="Selecciona un archivo PDF"
        idleSubtitle="Haz clic aquí o arrastra y suelta tu archivo PDF"
        dragTitle="Suelta el archivo PDF aquí"
        buttonLabel="Seleccionar archivo"
        ariaLabel="Seleccionar o arrastrar un archivo PDF"
        onFiles={(files) => handleFileSelect(files[0])}
      />

      <ToolConstraints items={tool.constraints} />

      {selectedFile && !resultBlob && (
        <Card className="mb-8 motion-safe:animate-slide-up" ref={fileInfoRef}>
          <CardContent className="p-4 sm:p-6">
            <div className="mb-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="font-display text-lg font-bold text-ink">
                Archivo seleccionado
              </h2>
              <Button
                variant="outline"
                size="sm"
                onClick={changeFileWithUndo}
                className="shrink-0"
              >
                <X className="mr-2 h-4 w-4" />
                Cambiar archivo
              </Button>
            </div>

            <div className="flex items-center gap-4 rounded-lg border-3 border-ink bg-surface p-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded border-2 border-ink bg-card">
                <FileText className="h-6 w-6 text-ink" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink">
                  {selectedFile.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatFileSize(selectedFile.size)}
                </p>
              </div>
            </div>

            {/* Aviso contextual según la detección de cifrado */}
            {mode === 'proteger' && isEncrypted === true && (
              <div className={cn('mt-6 rounded-lg border-3 border-ink p-3', accent.soft)}>
                <p className={cn('text-sm font-bold', accent.softText)}>
                  Este PDF ya tiene contraseña.
                </p>
                <p className={cn('mt-1 text-sm', accent.softText)}>
                  Para cambiarla, primero{' '}
                  <button
                    type="button"
                    onClick={() => switchMode('quitar')}
                    className="font-bold underline underline-offset-2 hover-fine:opacity-80"
                  >
                    quítala
                  </button>{' '}
                  y vuelve a protegerlo.
                </p>
              </div>
            )}
            {mode === 'quitar' && isEncrypted === false && (
              <div className={cn('mt-6 rounded-lg border-3 border-ink p-3', accent.soft)}>
                <p className={cn('text-sm', accent.softText)}>
                  Este PDF no parece tener contraseña. Si te equivocaste,{' '}
                  <button
                    type="button"
                    onClick={() => switchMode('proteger')}
                    className="font-bold underline underline-offset-2 hover-fine:opacity-80"
                  >
                    protégelo
                  </button>{' '}
                  en su lugar.
                </p>
              </div>
            )}

            {/* Campos de contraseña */}
            <div className="mt-6 space-y-4">
              <div>
                <label
                  htmlFor="pwd"
                  className="mb-1.5 block text-sm font-bold text-ink"
                >
                  {mode === 'proteger' ? 'Contraseña' : 'Contraseña actual'}
                </label>
                <div className="relative">
                  <Input
                    id="pwd"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={
                      mode === 'proteger' ? 'new-password' : 'current-password'
                    }
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={
                      mode === 'proteger'
                        ? 'Elige una contraseña'
                        : 'Escribe la contraseña del PDF'
                    }
                    className="pr-11"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && mode === 'quitar') runOperation();
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={
                      showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'
                    }
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover-fine:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {mode === 'proteger' && (
                <div>
                  <label
                    htmlFor="pwd2"
                    className="mb-1.5 block text-sm font-bold text-ink"
                  >
                    Confirmar contraseña
                  </label>
                  <Input
                    id="pwd2"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Repite la contraseña"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') runOperation();
                    }}
                  />
                  {confirm.length > 0 && confirm !== password && (
                    <p className="mt-1.5 text-sm text-destructive">
                      Las contraseñas no coinciden.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="mt-6">
              <Button
                onClick={runOperation}
                disabled={!canSubmit}
                aria-busy={isProcessing}
                size="lg"
                className={accent.solid}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    {mode === 'proteger' ? 'Protegiendo…' : 'Quitando…'}
                  </>
                ) : (
                  <>
                    {mode === 'proteger' ? (
                      <Lock className="mr-2 h-5 w-5" />
                    ) : (
                      <Unlock className="mr-2 h-5 w-5" />
                    )}
                    {verb}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {resultBlob && (
        <Card ref={resultRef} className="motion-safe:animate-slide-up">
          <CardContent className="p-4 sm:p-6">
            <div className="mb-6 text-center">
              <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full border-3 border-ink bg-success text-white">
                {mode === 'proteger' ? (
                  <ShieldCheck className="h-8 w-8" />
                ) : (
                  <Unlock className="h-8 w-8" />
                )}
              </div>
              <h2 className="mb-2 text-lg font-bold text-success">
                {mode === 'proteger'
                  ? '¡PDF protegido!'
                  : '¡Contraseña eliminada!'}
              </h2>
              <p className="mb-4 text-ink">
                {mode === 'proteger'
                  ? 'Tu PDF pedirá la contraseña al abrirse.'
                  : 'Tu PDF ya no pedirá contraseña.'}
              </p>
              <Button onClick={downloadResult} size="lg" className={accent.solid}>
                <Download className="mr-2 h-5 w-5" />
                Descargar PDF
              </Button>
            </div>

            <div className="text-center">
              <Button variant="outline" onClick={resetAll} size="lg">
                {mode === 'proteger' ? 'Proteger otro PDF' : 'Quitar a otro PDF'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </ToolShell>
  );
}
