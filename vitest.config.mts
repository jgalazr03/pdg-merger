import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Tests unitarios de la lógica pura (lib/). La UI se valida con e2e aparte; aquí
// no hay DOM: IndexedDB se simula con fake-indexeddb en los tests que lo piden.
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./', import.meta.url)) },
  },
  test: {
    include: ['lib/**/*.test.ts'],
    environment: 'node',
  },
});
