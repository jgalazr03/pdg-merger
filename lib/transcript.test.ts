import { describe, expect, it } from 'vitest';
import { clock, plainText, type Chunk } from './transcript';

describe('transcript', () => {
  it('formatea el reloj en m:ss y h:mm:ss', () => {
    expect(clock(65)).toBe('1:05');
    expect(clock(3661)).toBe('1:01:01');
  });

  it('plainText aplica los nombres de hablante', () => {
    const chunks: Chunk[] = [
      { timestamp: [0, 2], text: 'Hola', speaker: 0 },
      { timestamp: [2, 4], text: 'Qué tal', speaker: 1 },
    ];
    const out = plainText(chunks, { 0: 'Ana' });
    expect(out).toContain('Ana');
    expect(out).toContain('Qué tal');
  });
});
