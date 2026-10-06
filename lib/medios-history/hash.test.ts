import { describe, expect, it } from 'vitest';
import type { Chunk } from '@/lib/transcript';
import { sourceHashFor } from './hash';

const chunks: Chunk[] = [
  { timestamp: [0, 2], text: 'Hola', speaker: 0 },
  { timestamp: [2, 4], text: 'Adiós', speaker: 1 },
];

describe('sourceHashFor', () => {
  it('es estable para el mismo contenido', () => {
    expect(sourceHashFor('summary', chunks, { 0: 'Ana' })).toBe(
      sourceHashFor('summary', [...chunks], { 0: 'Ana' })
    );
  });

  it('cambia si se corrige el texto', () => {
    const edited = [chunks[0], { ...chunks[1], text: 'Hasta luego' }];
    expect(sourceHashFor('summary', edited, {})).not.toBe(
      sourceHashFor('summary', chunks, {})
    );
  });

  it('renombrar hablantes invalida el resumen pero no la traducción', () => {
    expect(sourceHashFor('summary', chunks, { 0: 'Ana' })).not.toBe(
      sourceHashFor('summary', chunks, {})
    );
    expect(sourceHashFor('translation', chunks, { 0: 'Ana' })).toBe(
      sourceHashFor('translation', chunks, {})
    );
  });

  it('ignora nombres vacíos y el orden de las claves', () => {
    expect(sourceHashFor('analysis', chunks, { 1: 'Luis', 0: 'Ana', 2: ' ' })).toBe(
      sourceHashFor('analysis', chunks, { 0: 'Ana', 1: 'Luis' })
    );
  });

  it('usa el texto plano cuando no hay segmentos', () => {
    expect(sourceHashFor('summary', [], {}, 'a')).not.toBe(
      sourceHashFor('summary', [], {}, 'b')
    );
  });
});
