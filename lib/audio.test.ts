import { afterEach, describe, expect, it, vi } from 'vitest';
import { isSilent, prepareForUpload } from './audio';

describe('isSilent', () => {
  it('detecta un buffer en ceros (decodificación muda de Safari)', () => {
    expect(isSilent(new Float32Array(16000 * 60))).toBe(true);
  });

  it('no confunde audio real con silencio', () => {
    const pcm = new Float32Array(16000 * 60);
    for (let i = 0; i < pcm.length; i++) pcm[i] = 0.2 * Math.sin(i / 10);
    expect(isSilent(pcm)).toBe(false);
  });

  it('encuentra voz aunque solo aparezca en un tramo', () => {
    const pcm = new Float32Array(16000 * 600);
    for (let i = 16000 * 300; i < 16000 * 302; i++) pcm[i] = 0.1;
    expect(isSilent(pcm)).toBe(false);
  });
});

describe('prepareForUpload en iPhone', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sube el original sin decodificarlo (Safari iOS corrompe el audio de videos)', async () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15',
      platform: 'iPhone',
      maxTouchPoints: 5,
    });
    const arrayBuffer = vi.fn();
    const file = { name: 'Act02video.mov', size: 5_000_000, arrayBuffer } as unknown as File;
    const out = await prepareForUpload(file);
    expect(out).toEqual({ blob: file, name: 'Act02video.mov', downsampled: false });
    expect(arrayBuffer).not.toHaveBeenCalled();
  });

  it('detecta el iPad que se anuncia como Mac', async () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15',
      platform: 'MacIntel',
      maxTouchPoints: 5,
    });
    const arrayBuffer = vi.fn();
    const file = { name: 'a.mov', size: 1000, arrayBuffer } as unknown as File;
    await prepareForUpload(file);
    expect(arrayBuffer).not.toHaveBeenCalled();
  });
});
