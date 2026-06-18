'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AudioLines,
  FileAudio,
  FileVideo,
  X,
  Download,
  Copy,
  Loader2,
  Check,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { getTool } from '@/lib/tools';
import { cn, scrollIntoViewSafe } from '@/lib/utils';
import ToolShell from '@/components/tools/ToolShell';
import FileDropzone from '@/components/tools/FileDropzone';
import ToolConstraints from '@/components/tools/ToolConstraints';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';

const tool = getTool('transcribir');
const accent = tool.accent;

const ACCEPT = '.mp3,.wav,.m4a,.ogg,.mp4,.webm,audio/*,video/*';

type Chunk = { timestamp: [number, number | null]; text: string };
type Phase = 'idle' | 'decoding' | 'loading' | 'transcribing' | 'done' | 'error';

const isMedia = (f: File) =>
  f.type.startsWith('audio/') ||
  f.type.startsWith('video/') ||
  /\.(mp3|wav|m4a|ogg|mp4|webm|aac|flac|mov)$/i.test(f.name);

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Decodifica un archivo de audio/video a PCM mono de 16 kHz (lo que espera
 *  Whisper), remuestreando con un OfflineAudioContext. */
async function decodeAudioTo16kMono(file: File): Promise<Float32Array> {
  const buf = await file.arrayBuffer();
  const AC: typeof AudioContext =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  const ctx = new AC();
  let decoded: AudioBuffer;
  try {
    decoded = await ctx.decodeAudioData(buf);
  } finally {
    void ctx.close();
  }
  const target = 16000;
  const offline = new OfflineAudioContext(
    1,
    Math.max(1, Math.ceil(decoded.duration * target)),
    target
  );
  const src = offline.createBufferSource();
  src.buffer = decoded;
  src.connect(offline.destination);
  src.start();
  const rendered = await offline.startRendering();
  // Copia con buffer propio para poder transferirlo al worker.
  return rendered.getChannelData(0).slice();
}

function pad(n: number, len = 2): string {
  return String(n).padStart(len, '0');
}

function srtTime(t: number): string {
  const ms = Math.floor((t - Math.floor(t)) * 1000);
  const s = Math.floor(t) % 60;
  const m = Math.floor(t / 60) % 60;
  const h = Math.floor(t / 3600);
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}

function toSrt(chunks: Chunk[]): string {
  return chunks
    .map((c, i) => {
      const start = c.timestamp[0] ?? 0;
      const end = c.timestamp[1] ?? start + 2;
      return `${i + 1}\n${srtTime(start)} --> ${srtTime(end)}\n${c.text.trim()}`;
    })
    .join('\n\n');
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

export default function Transcriber() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [modelPct, setModelPct] = useState(0);
  const [text, setText] = useState('');
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [errorMsg, setErrorMsg] = useState('');

  const workerRef = useRef<Worker | null>(null);
  const progressRef = useRef<Map<string, { loaded: number; total: number }>>(
    new Map()
  );
  const fileInfoRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

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
    setErrorMsg('');
  };

  const reset = () => {
    setSelectedFile(null);
    setPhase('idle');
    setText('');
    setChunks([]);
    setErrorMsg('');
    setModelPct(0);
  };

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
      case 'complete':
        setText(d.text);
        setChunks(d.chunks);
        setPhase('done');
        break;
      case 'error':
        setErrorMsg(d.message || 'Error al transcribir');
        setPhase('error');
        break;
    }
  };

  const handleTranscribe = async () => {
    if (!selectedFile) return;
    setErrorMsg('');
    setText('');
    setChunks([]);
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

  const isVideo = selectedFile?.type.startsWith('video/');
  const busy = phase === 'decoding' || phase === 'loading' || phase === 'transcribing';
  const step: 1 | 2 | 3 = !selectedFile ? 1 : phase === 'done' ? 3 : 2;
  const baseName = selectedFile?.name.replace(/\.[^.]+$/, '') || 'transcripcion';

  const phaseLabel =
    phase === 'decoding'
      ? 'Leyendo el audio…'
      : phase === 'loading'
        ? modelPct > 0
          ? `Descargando el modelo… ${modelPct}%`
          : 'Preparando el modelo…'
        : phase === 'transcribing'
          ? 'Transcribiendo… (puede tardar según la duración)'
          : '';

  return (
    <ToolShell tool={tool} step={step}>
      <FileDropzone
        className="mb-4"
        accent={accent}
        accept={ACCEPT}
        idleTitle="Selecciona un audio o video"
        idleSubtitle="Haz clic aquí o arrastra y suelta tu grabación (MP3, WAV, M4A, OGG, MP4)"
        dragTitle="Suelta la grabación aquí"
        buttonLabel="Seleccionar archivo"
        ariaLabel="Seleccionar o arrastrar un audio o video"
        onFiles={(files) => handleFileSelect(files[0])}
      />

      <ToolConstraints items={tool.constraints} />

      {selectedFile && (
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
                    className="w-full rounded-lg border-3 border-ink"
                  />
                ) : (
                  <audio src={previewUrl} controls className="w-full" />
                )}
              </div>
            )}

            {phase !== 'done' && (
              <div className="mt-6">
                <Button
                  onClick={handleTranscribe}
                  disabled={busy}
                  size="lg"
                  className={accent.solid}
                  aria-busy={busy}
                >
                  {busy ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    <AudioLines className="mr-2 h-5 w-5" />
                  )}
                  {busy ? 'Procesando…' : 'Transcribir'}
                </Button>

                {busy && (
                  <div className="mt-4">
                    <p className="mb-2 text-sm font-medium text-ink">{phaseLabel}</p>
                    {phase === 'loading' && modelPct > 0 && (
                      <Progress value={modelPct} />
                    )}
                    <p className="mt-2 text-xs text-muted-foreground">
                      La primera vez se descarga el modelo (~150 MB) y queda
                      guardado en tu navegador. Tu grabación no sale de tu equipo.
                    </p>
                  </div>
                )}

                {phase === 'error' && errorMsg && (
                  <div className="mt-4 flex items-start gap-2 rounded-lg border-3 border-destructive bg-destructive/5 p-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                    <p className="text-sm text-destructive">{errorMsg}</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {phase === 'done' && (
        <Card ref={resultRef} className="motion-safe:animate-slide-up">
          <CardContent className="p-4 sm:p-6">
            <div className="mb-4 flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border-3 border-ink bg-success text-white">
                <Check className="h-5 w-5" strokeWidth={3} />
              </span>
              <h2 className="font-display text-lg font-bold text-ink">
                Transcripción lista
              </h2>
            </div>

            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={12}
              aria-label="Texto de la transcripción (editable)"
              className="font-mono"
            />

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
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
              <Button
                onClick={() => triggerDownload(text, `${baseName}.txt`)}
                className={accent.solid}
              >
                <Download className="mr-2 h-4 w-4" />
                Descargar .txt
              </Button>
              {chunks.length > 0 && (
                <Button
                  onClick={() => triggerDownload(toSrt(chunks), `${baseName}.srt`)}
                  variant="outline"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Subtítulos .srt
                </Button>
              )}
              <Button variant="outline" onClick={reset}>
                Transcribir otro
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </ToolShell>
  );
}
