import { existsSync, openAsBlob, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { probeHasAudio } from './media-probe';

// Archivos reales diminutos generados con ffmpeg (ver lib/__fixtures__).
const fixture = (name: string) =>
  new Blob([readFileSync(fileURLToPath(new URL(`./__fixtures__/${name}`, import.meta.url)))]);

describe('probeHasAudio', () => {
  it('video sin pista de audio (grabación de pantalla sin micrófono) → false', async () => {
    expect(await probeHasAudio(fixture('video-sin-audio.mov'))).toBe(false);
  });

  it('QuickTime con audio → true', async () => {
    expect(await probeHasAudio(fixture('video-con-audio.mov'))).toBe(true);
  });

  it('MP4 con el índice al inicio (faststart) → true', async () => {
    expect(await probeHasAudio(fixture('video-con-audio-faststart.mp4'))).toBe(true);
  });

  it('M4A (solo audio) → true', async () => {
    expect(await probeHasAudio(fixture('audio.m4a'))).toBe(true);
  });

  it('formatos que no son MP4/MOV (WAV) → null: decide el decodificador', async () => {
    expect(await probeHasAudio(fixture('audio.wav'))).toBeNull();
  });

  it('basura o archivo vacío → null, sin lanzar', async () => {
    expect(await probeHasAudio(new Blob([new Uint8Array(3)]))).toBeNull();
    expect(await probeHasAudio(new Blob(['no es un video de verdad']))).toBeNull();
  });

  // Caso real que originó esto (grabación de pantalla de 150 MB sin audio).
  // Solo corre donde existe el archivo; en CI se omite.
  const REAL = process.env.PROBE_REAL_FILE;
  it.skipIf(!REAL || !existsSync(REAL))(
    'archivo real de 150 MB: detecta que no hay audio leyendo < 100 KB',
    async () => {
      const real = await openAsBlob(REAL!);
      let bytesRead = 0;
      const spy = {
        size: real.size,
        slice: (start?: number, end?: number) => {
          bytesRead += (end ?? real.size) - (start ?? 0);
          return real.slice(start, end);
        },
      };
      expect(await probeHasAudio(spy)).toBe(false);
      expect(bytesRead).toBeLessThan(100 * 1024);
    }
  );
});
