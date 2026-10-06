import { describe, expect, it } from 'vitest';
import { isSilent } from './audio';

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
