/*
 * Worker de transcripción (Whisper vía transformers.js). Vive en public/ como
 * JS plano —NO lo procesa el bundler de Next— para no disparar el bug de
 * WASM/App Router de Next 13.5.1 (mismo motivo por el que tesseract y pdf.worker
 * se sirven como estáticos). El audio se procesa aquí, en el equipo del usuario;
 * solo el modelo (pesos públicos) se descarga una vez y queda en caché del
 * navegador.
 */
import {
  pipeline,
  env,
} from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0';

// El modelo se obtiene del Hub (cacheado en el navegador tras la 1ª vez).
env.allowLocalModels = false;

const MODEL_ID = 'onnx-community/whisper-base';

let transcriber = null;
let loadPromise = null;

/** Carga perezosa y memoizada del pipeline ASR. */
function getTranscriber() {
  if (loadPromise) return loadPromise;
  const useGpu = typeof navigator !== 'undefined' && 'gpu' in navigator;
  loadPromise = pipeline('automatic-speech-recognition', MODEL_ID, {
    device: useGpu ? 'webgpu' : 'wasm',
    dtype: useGpu ? 'fp32' : 'q8',
    progress_callback: (p) => {
      // p.status: 'initiate' | 'download' | 'progress' | 'done' | 'ready'
      if (p.status === 'progress') {
        self.postMessage({
          status: 'model-progress',
          file: p.file,
          progress: p.progress ?? 0,
          loaded: p.loaded ?? 0,
          total: p.total ?? 0,
        });
      } else if (p.status === 'ready' || p.status === 'done') {
        self.postMessage({ status: 'model-file-done', file: p.file });
      }
    },
  })
    .then((t) => {
      transcriber = t;
      return t;
    })
    .catch((err) => {
      loadPromise = null; // permite reintento
      throw err;
    });
  return loadPromise;
}

self.onmessage = async (event) => {
  const { type } = event.data;
  if (type !== 'transcribe') return;

  const { audio } = event.data;
  try {
    self.postMessage({ status: 'loading-model' });
    const asr = await getTranscriber();

    self.postMessage({ status: 'transcribing' });
    const output = await asr(audio, {
      language: 'spanish',
      task: 'transcribe',
      return_timestamps: true,
      chunk_length_s: 30,
      stride_length_s: 5,
    });

    // Whisper/transformers.js a veces emite un chunk sin `text` (límites de
    // fragmento o silencios). Normalizamos para garantizar el contrato
    // Chunk.text: string y evitar que los formateadores revienten al hacer .trim().
    const chunks = Array.isArray(output.chunks)
      ? output.chunks.map((c) => ({
          timestamp: c.timestamp,
          text: typeof c.text === 'string' ? c.text : '',
        }))
      : [];

    self.postMessage({
      status: 'complete',
      text: (output.text || '').trim(),
      chunks,
    });
  } catch (err) {
    self.postMessage({
      status: 'error',
      message: (err && err.message) || 'Error al transcribir',
    });
  }
};
