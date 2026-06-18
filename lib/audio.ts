// Utilidades de audio del lado cliente (módulo Medios). El modelo de ASR opera
// internamente a 16 kHz mono: subir el audio a esa tasa NO degrada la precisión
// (la calidad de reconocimiento se estabiliza por encima de 16 kHz; bajar de ahí
// sí penaliza), pero reduce muchísimo los bytes a transferir —sobre todo en
// video—, acelerando la subida a Blob y la descarga que hace Deepgram.

/** Decodifica un archivo de audio/video a PCM mono de 16 kHz (lo que espera el
 *  ASR), remuestreando con un OfflineAudioContext. */
export async function decodeAudioTo16kMono(file: File): Promise<Float32Array> {
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

/** Codifica PCM float a un WAV PCM 16-bit mono (linear16). Sin dependencias:
 *  Deepgram lee el header RIFF y lo procesa directo. */
export function encodeWav16kMono(samples: Float32Array, sampleRate = 16000): Blob {
  const dataSize = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  let off = 0;
  const str = (s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off++, s.charCodeAt(i));
  };
  str('RIFF');
  view.setUint32(off, 36 + dataSize, true);
  off += 4;
  str('WAVE');
  str('fmt ');
  view.setUint32(off, 16, true); // tamaño del subchunk fmt
  off += 4;
  view.setUint16(off, 1, true); // PCM
  off += 2;
  view.setUint16(off, 1, true); // mono
  off += 2;
  view.setUint32(off, sampleRate, true);
  off += 4;
  view.setUint32(off, sampleRate * 2, true); // byte rate (mono 16-bit)
  off += 4;
  view.setUint16(off, 2, true); // block align
  off += 2;
  view.setUint16(off, 16, true); // bits por muestra
  off += 2;
  str('data');
  view.setUint32(off, dataSize, true);
  off += 4;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    off += 2;
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

export type PreparedUpload = { blob: Blob; name: string; downsampled: boolean };

// Techo de seguridad de memoria: decodificar a PCM carga todo el audio en RAM
// (~115 MB por hora a 16 kHz). Por encima de esto subimos el original tal cual
// para no arriesgar un OOM en el navegador.
const MAX_PREPROCESS_BYTES = 120 * 1024 * 1024;

/**
 * Prepara el archivo para el modo servidor: lo reduce a 16 kHz mono (WAV) y lo
 * sube SOLO si eso achica la transferencia (video y WAV/FLAC ganan mucho; un
 * MP3/M4A ya comprimido no, y entonces se sube el original). Ante cualquier
 * fallo de decodificación, cae al original: nunca bloquea la transcripción.
 */
export async function prepareForUpload(file: File): Promise<PreparedUpload> {
  if (file.size > MAX_PREPROCESS_BYTES) {
    return { blob: file, name: file.name, downsampled: false };
  }
  try {
    const pcm = await decodeAudioTo16kMono(file);
    const wav = encodeWav16kMono(pcm);
    if (wav.size < file.size) {
      const base = file.name.replace(/\.[^.]+$/, '') || 'audio';
      return { blob: wav, name: `${base}.wav`, downsampled: true };
    }
  } catch {
    // Formato no decodificable por Web Audio, memoria insuficiente, etc.
  }
  return { blob: file, name: file.name, downsampled: false };
}
