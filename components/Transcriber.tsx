'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AudioLines,
  FileAudio,
  FileVideo,
  X,
  Copy,
  Loader2,
  Check,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';
import { getTool, type ToolDef } from '@/lib/tools';
import { cn, scrollIntoViewSafe } from '@/lib/utils';
import ToolShell from '@/components/tools/ToolShell';
import FileDropzone from '@/components/tools/FileDropzone';
import ToolConstraints from '@/components/tools/ToolConstraints';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { upload } from '@vercel/blob/client';
import TranscriptPlayer, {
  type TranscriptPlayerHandle,
} from '@/components/medios/TranscriptPlayer';
import DownloadMenu from '@/components/medios/DownloadMenu';
import AiWorkspace, { type WorkspaceTab } from '@/components/medios/AiWorkspace';
import SpeakerNamer from '@/components/medios/SpeakerNamer';
import VocabEditor from '@/components/medios/VocabEditor';
import ConsentKit from '@/components/medios/ConsentKit';
import { loadVocab, saveVocab } from '@/lib/customVocab';
import {
  type Chunk,
  type SpeakerNames,
  plainText,
  timedText,
  toSrt,
  toVtt,
} from '@/lib/transcript';
import { decodeAudioTo16kMono, prepareForUpload } from '@/lib/audio';


const ACCEPT = '.mp3,.wav,.m4a,.ogg,.mp4,.webm,audio/*,video/*';

type Phase =
  | 'idle'
  | 'decoding'
  | 'loading'
  | 'uploading'
  | 'transcribing'
  | 'done'
  | 'error';
type Mode = 'local' | 'server';

const isMedia = (f: File) =>
  f.type.startsWith('audio/') ||
  f.type.startsWith('video/') ||
  /\.(mp3|wav|m4a|ogg|mp4|webm|aac|flac|mov)$/i.test(f.name);


function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function triggerDownload(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function Transcriber({
  tool = getTool('transcribir'),
  defaultPanel = 'preguntar',
  variant = 'general',
}: {
  /** Permite reusar el pipeline en otras herramientas de Medios (p. ej. Analizar). */
  tool?: ToolDef;
  /** Pestaña del workspace abierta por defecto al terminar. */
  defaultPanel?: WorkspaceTab;
  /** 'contable' activa las features verticales (consentimiento LFPDPPP,
   *  vocabulario del despacho, precisión fiscal, plantillas contables). La
   *  herramienta "Transcribir" genérica usa 'general' y queda limpia. */
  variant?: 'general' | 'contable';
} = {}) {
  const accent = tool.accent;
  const contable = variant === 'contable';
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [modelPct, setModelPct] = useState(0);
  const [text, setText] = useState('');
  const [chunks, setChunks] = useState<Chunk[]>([]);
  // Nombres que el usuario le pone a cada hablante diarizado; se propagan a la
  // transcripción, el reparto de participación, el resumen y el análisis.
  const [speakerNames, setSpeakerNames] = useState<SpeakerNames>({});
  const [errorMsg, setErrorMsg] = useState('');
  const [mode, setMode] = useState<Mode>('local');
  const [uploadPct, setUploadPct] = useState(0);
  // Vocabulario del despacho (clientes/siglas) para el keyterm boosting del modo
  // servidor; persiste en localStorage (se carga tras montar, no en SSR).
  const [vocab, setVocab] = useState<string[]>([]);
  const updateVocab = (next: string[]) => setVocab(saveVocab(next));
  // Cambia con cada transcripción terminada: fuerza el remonte de
  // TranscriptPlayer para reinicializar el texto editable.
  const [runId, setRunId] = useState(0);

  const workerRef = useRef<Worker | null>(null);
  const progressRef = useRef<Map<string, { loaded: number; total: number }>>(
    new Map()
  );
  const fileInfoRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  // Control imperativo del reproductor (para que el panel de preguntas salte a
  // un momento citado).
  const playerRef = useRef<TranscriptPlayerHandle>(null);

  // Preview reproducible; libera el objectURL al cambiar/limpiar.
  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);

  // Termina el worker al desmontar (libera el modelo en memoria).
  useEffect(() => {
    return () => workerRef.current?.terminate();
  }, []);

  // Carga el vocabulario guardado tras montar (localStorage no existe en SSR).
  useEffect(() => {
    setVocab(loadVocab());
  }, []);

  useEffect(() => {
    if (selectedFile && fileInfoRef.current) {
      setTimeout(() => scrollIntoViewSafe(fileInfoRef.current), 100);
    }
  }, [selectedFile]);

  useEffect(() => {
    if (phase === 'done') {
      setTimeout(() => scrollIntoViewSafe(resultRef.current), 100);
    }
  }, [phase]);

  const handleFileSelect = (file: File) => {
    if (!isMedia(file)) {
      toast.error('Archivo no válido', {
        description: 'Selecciona un audio o video (MP3, WAV, M4A, OGG, MP4).',
      });
      return;
    }
    setSelectedFile(file);
    setPhase('idle');
    setText('');
    setChunks([]);
    setSpeakerNames({});
    setErrorMsg('');
  };

  const reset = () => {
    setSelectedFile(null);
    setPhase('idle');
    setText('');
    setChunks([]);
    setSpeakerNames({});
    setErrorMsg('');
    setModelPct(0);
  };

  // El usuario corrigió el texto de un segmento en el reproductor: guardamos los
  // chunks y el efecto de abajo re-deriva el texto plano (con nombres) para
  // copiar/descargar/IA.
  const handleEdit = (ch: Chunk[]) => {
    setChunks(ch);
  };

  // `text` es la versión plana de la transcripción (con los nombres de hablante
  // aplicados). Se re-deriva cuando cambian los chunks o los nombres, así el
  // resumen, el análisis y el copiar/descargar siempre usan el nombre real.
  useEffect(() => {
    if (chunks.length) setText(plainText(chunks, speakerNames));
  }, [chunks, speakerNames]);

  const handleWorkerMessage = (e: MessageEvent) => {
    const d = e.data;
    switch (d.status) {
      case 'loading-model':
        setPhase('loading');
        break;
      case 'model-progress': {
        progressRef.current.set(d.file, { loaded: d.loaded, total: d.total });
        let loaded = 0;
        let total = 0;
        progressRef.current.forEach((v) => {
          loaded += v.loaded;
          total += v.total;
        });
        setModelPct(total > 0 ? Math.round((loaded / total) * 100) : 0);
        break;
      }
      case 'transcribing':
        setPhase('transcribing');
        break;
      case 'complete': {
        const ch: Chunk[] = Array.isArray(d.chunks) ? d.chunks : [];
        setChunks(ch);
        setText(ch.length ? plainText(ch) : (d.text || '').trim());
        setRunId((n) => n + 1);
        setPhase('done');
        break;
      }
      case 'error':
        setErrorMsg(d.message || 'Error al transcribir');
        setPhase('error');
        break;
    }
  };

  const handleTranscribe = () => {
    if (!selectedFile) return;
    setErrorMsg('');
    setText('');
    setChunks([]);
    setSpeakerNames({});
    if (mode === 'server') void transcribeServer();
    else void transcribeLocal();
  };

  // Modo privado: Whisper en el navegador (el audio no sale del equipo).
  const transcribeLocal = async () => {
    if (!selectedFile) return;
    setPhase('decoding');

    let audio: Float32Array;
    try {
      audio = await decodeAudioTo16kMono(selectedFile);
    } catch {
      setErrorMsg(
        'No se pudo leer el audio de este archivo. Prueba con MP3, WAV o M4A.'
      );
      setPhase('error');
      return;
    }

    if (!workerRef.current) {
      workerRef.current = new Worker('/transcribe-worker.js', {
        type: 'module',
      });
      workerRef.current.onmessage = handleWorkerMessage;
      workerRef.current.onerror = () => {
        setErrorMsg('No se pudo iniciar el motor de transcripción.');
        setPhase('error');
      };
    }

    progressRef.current.clear();
    setModelPct(0);
    setPhase('loading');
    workerRef.current.postMessage({ type: 'transcribe', audio }, [audio.buffer]);
  };

  // Modo servidor: reduce a 16 kHz mono, sube a Vercel Blob (cualquier tamaño) y
  // Deepgram Nova-3 transcribe el blob por URL. La subida empieza al pulsar
  // Transcribir (nada sale del equipo antes de eso).
  const transcribeServer = async () => {
    if (!selectedFile) return;
    try {
      setPhase('decoding');
      const prepared = await prepareForUpload(selectedFile);
      setUploadPct(0);
      setPhase('uploading');
      const blob = await upload(prepared.name, prepared.blob, {
        access: 'public',
        handleUploadUrl: '/api/blob-upload',
        onUploadProgress: (e) => setUploadPct(Math.round(e.percentage)),
      });
      setPhase('transcribing');
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: blob.url,
          keyterms: contable ? vocab : [],
          domain: variant,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Error del servidor');
      const ch: Chunk[] = Array.isArray(data.chunks) ? data.chunks : [];
      setChunks(ch);
      setText(ch.length ? plainText(ch) : (data.text || '').trim());
      setRunId((n) => n + 1);
      setPhase('done');
    } catch (e) {
      setErrorMsg(
        (e as Error).message || 'No se pudo transcribir en el servidor.'
      );
      setPhase('error');
    }
  };

  const isVideo = selectedFile?.type.startsWith('video/');
  const busy =
    phase === 'decoding' ||
    phase === 'loading' ||
    phase === 'uploading' ||
    phase === 'transcribing';
  const step: 1 | 2 | 3 = !selectedFile ? 1 : phase === 'done' ? 3 : 2;
  const baseName = selectedFile?.name.replace(/\.[^.]+$/, '') || 'transcripcion';

  const phaseLabel =
    phase === 'decoding'
      ? 'Preparando el audio…'
      : phase === 'uploading'
        ? `Subiendo el audio… ${uploadPct}%`
        : phase === 'loading'
          ? modelPct > 0
            ? `Descargando el modelo… ${modelPct}%`
            : 'Preparando el modelo…'
          : phase === 'transcribing'
            ? mode === 'server'
              ? 'Transcribiendo en el servidor (Nova-3)…'
              : 'Transcribiendo… (puede tardar según la duración)'
            : '';
  // El loader es uno solo y abarca todas las fases: barra con porcentaje cuando
  // lo conocemos (subida, descarga del modelo) e indeterminada cuando no
  // (preparando, transcribiendo). Solo cambia el texto.
  const hasPct = phase === 'uploading' || (phase === 'loading' && modelPct > 0);
  const loaderPct = phase === 'uploading' ? uploadPct : modelPct;

  return (
    <ToolShell tool={tool} step={step}>
      <FileDropzone
        className="mb-4"
        accent={accent}
        loaded={step > 1}
        accept={ACCEPT}
        idleTitle="Selecciona un audio o video"
        idleSubtitle="Haz clic aquí o arrastra y suelta tu grabación (MP3, WAV, M4A, OGG, MP4)"
        dragTitle="Suelta la grabación aquí"
        buttonLabel="Seleccionar archivo"
        ariaLabel="Seleccionar o arrastrar un audio o video"
        onFiles={(files) => handleFileSelect(files[0])}
      />

      <ToolConstraints items={tool.constraints} />

      {contable && <ConsentKit accent={accent} />}

      {selectedFile && phase !== 'done' && (
        <Card className="mb-8 motion-safe:animate-slide-up" ref={fileInfoRef}>
          <CardContent className="p-4 sm:p-6">
            <div className="mb-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="font-display text-lg font-bold text-ink">
                Grabación seleccionada
              </h2>
              <Button
                variant="outline"
                size="sm"
                onClick={reset}
                disabled={busy}
                className="shrink-0"
              >
                <X className="mr-2 h-4 w-4" />
                Cambiar archivo
              </Button>
            </div>

            <div className="flex items-center gap-4 rounded-lg border-3 border-ink bg-surface p-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded border-2 border-ink bg-card">
                {isVideo ? (
                  <FileVideo className="h-6 w-6 text-ink" />
                ) : (
                  <FileAudio className="h-6 w-6 text-ink" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink">{selectedFile.name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatFileSize(selectedFile.size)}
                </p>
              </div>
            </div>

            {previewUrl && (
              <div className="mt-4">
                {isVideo ? (
                  <video
                    src={previewUrl}
                    controls
                    playsInline
                    className="w-full rounded-lg border-3 border-ink"
                  />
                ) : (
                  <audio src={previewUrl} controls className="w-full" />
                )}
              </div>
            )}

            <div className="mt-6">
                {/* Modo: privado (navegador) vs servidor (Nova-3). */}
                <div
                  className="mb-5"
                  role="group"
                  aria-label="Modo de transcripción"
                >
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(
                      [
                        {
                          key: 'local',
                          title: 'En tu navegador',
                          desc: 'Privado, nada se sube. Puede ser más lento.',
                        },
                        {
                          key: 'server',
                          title: 'En el servidor (Nova-3)',
                          desc: 'Más rápido y preciso. Identifica hablantes.',
                        },
                      ] as const
                    ).map((opt) => {
                      const active = mode === opt.key;
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => setMode(opt.key)}
                          disabled={busy}
                          aria-pressed={active}
                          className={cn(
                            'rounded-lg border-3 border-ink px-4 py-3 text-left transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 disabled:opacity-50',
                            active
                              ? 'bg-ink text-white'
                              : 'bg-surface text-ink hover-fine:bg-muted'
                          )}
                        >
                          <span className="block text-sm font-bold">
                            {opt.title}
                          </span>
                          <span
                            className={cn(
                              'block text-xs',
                              active ? 'text-white/70' : 'text-muted-foreground'
                            )}
                          >
                            {opt.desc}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {mode === 'local'
                      ? 'Tu grabación se procesa en el navegador; nada se sube. Ideal para audios cortos.'
                      : 'Tu grabación se sube para transcribirse con Deepgram Nova-3 (máxima precisión, cualquier tamaño, identifica a cada hablante) y se borra al terminar.'}
                  </p>

                  {mode === 'server' && contable && (
                    <VocabEditor
                      terms={vocab}
                      onChange={updateVocab}
                      accent={accent}
                    />
                  )}
                </div>

                {/* El botón se oculta mientras procesa: el loader de abajo es
                    el único indicador de "en curso" (evita doble spinner). */}
                {!busy && (
                  <Button
                    onClick={handleTranscribe}
                    size="lg"
                    className={accent.solid}
                  >
                    <AudioLines className="mr-2 h-5 w-5" />
                    Transcribir
                  </Button>
                )}

                {busy && (
                  <div className="mt-4 rounded-lg border-3 border-ink bg-surface p-4">
                    <div className="flex items-center gap-3">
                      <Loader2
                        className={cn('h-5 w-5 shrink-0 animate-spin', accent.text)}
                      />
                      <p
                        className="text-sm font-medium text-ink"
                        aria-live="polite"
                      >
                        {phaseLabel}
                      </p>
                    </div>
                    <div className="mt-3">
                      {hasPct ? (
                        <Progress value={loaderPct} />
                      ) : (
                        // Barra indeterminada: el proceso sigue, sin porcentaje.
                        <div
                          role="progressbar"
                          aria-label={phaseLabel}
                          className="relative h-4 w-full overflow-hidden rounded-lg border-3 border-ink bg-surface"
                        >
                          <div className="absolute inset-y-0 left-0 w-1/3 bg-highlight motion-safe:animate-indeterminate" />
                        </div>
                      )}
                    </div>
                    {mode === 'local' && phase === 'loading' && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        La primera vez se descarga el modelo (~150 MB) y queda
                        guardado en tu navegador. Tu grabación no sale de tu equipo.
                      </p>
                    )}
                  </div>
                )}

                {phase === 'error' && errorMsg && (
                  <div className="mt-4 flex items-start gap-2 rounded-lg border-3 border-destructive bg-destructive/5 p-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                    <p className="text-sm text-destructive">{errorMsg}</p>
                  </div>
                )}
            </div>
          </CardContent>
        </Card>
      )}

      {phase === 'done' && (
        <div ref={resultRef} className="motion-safe:animate-slide-up">
          {/* Estado + acción de reinicio claramente separada del recurso actual */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border-3 border-ink bg-success text-white">
                <Check className="h-5 w-5" strokeWidth={3} />
              </span>
              <h2 className="font-display text-lg font-bold text-ink">
                Transcripción lista
              </h2>
            </div>
            <Button variant="outline" size="sm" onClick={reset}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Transcribir otro
            </Button>
          </div>

          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            {/* Izquierda: reproductor + transcripción + exportar */}
            <div className="min-w-0 space-y-4">
              {chunks.length > 0 && previewUrl ? (
                <>
                  <SpeakerNamer
                    chunks={chunks}
                    names={speakerNames}
                    onChange={setSpeakerNames}
                    accent={accent}
                  />
                  <TranscriptPlayer
                    key={runId}
                    ref={playerRef}
                    chunks={chunks}
                    mediaUrl={previewUrl}
                    isVideo={!!isVideo}
                    accent={accent}
                    names={speakerNames}
                    onChange={handleEdit}
                  />
                </>
              ) : (
                <Textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={12}
                  aria-label="Texto de la transcripción (editable)"
                  className="font-mono"
                />
              )}

              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start">
                <Button
                  onClick={() => {
                    void navigator.clipboard
                      .writeText(text)
                      .then(() => toast.success('Texto copiado'));
                  }}
                  variant="outline"
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copiar
                </Button>
                {chunks.length > 0 && (
                  <Button
                    onClick={() => {
                      void navigator.clipboard
                        .writeText(timedText(chunks, speakerNames))
                        .then(() =>
                          toast.success('Copiado con marcas de tiempo')
                        );
                    }}
                    variant="outline"
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copiar con tiempos
                  </Button>
                )}
                <DownloadMenu
                  className={accent.solid}
                  items={[
                    {
                      label: 'Texto (.txt)',
                      onSelect: () => triggerDownload(text, `${baseName}.txt`),
                    },
                    ...(chunks.length > 0
                      ? [
                          {
                            label: 'Subtítulos (.srt)',
                            onSelect: () =>
                              triggerDownload(toSrt(chunks), `${baseName}.srt`),
                          },
                          {
                            label: 'Subtítulos (.vtt)',
                            onSelect: () =>
                              triggerDownload(toVtt(chunks), `${baseName}.vtt`),
                          },
                        ]
                      : []),
                  ]}
                />
              </div>
            </div>

            {/* Derecha: workspace de herramientas AI (pestañas, no pila de cards) */}
            {chunks.length > 0 && previewUrl && (
              <div className="min-w-0 lg:sticky lg:top-24 lg:self-start">
                <AiWorkspace
                  key={runId}
                  chunks={chunks}
                  text={text}
                  accent={accent}
                  baseName={baseName}
                  names={speakerNames}
                  defaultTab={defaultPanel}
                  variant={variant}
                  onSeek={(t) => playerRef.current?.seekTo(t)}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </ToolShell>
  );
}
