// Copia el binario WASM de qpdf a public/ para servirlo en runtime vía
// `locateFile: () => '/qpdf.wasm'`. Se ejecuta en `prebuild` (npm lo corre
// automáticamente antes de `build`, también en Vercel) y puede correrse a mano
// tras instalar dependencias. NO importar el .wasm por el bundler: eso dispara
// el error `entryOptions.layer` del App Router en Next 13.5.1.
const fs = require('fs');
const path = require('path');

const src = path.join(
  __dirname,
  '..',
  'node_modules',
  '@neslinesli93',
  'qpdf-wasm',
  'dist',
  'qpdf.wasm'
);
const dest = path.join(__dirname, '..', 'public', 'qpdf.wasm');

try {
  fs.copyFileSync(src, dest);
  console.log('[copy-wasm] qpdf.wasm copiado a public/');
} catch (err) {
  console.error('[copy-wasm] No se pudo copiar qpdf.wasm:', err.message);
  process.exit(1);
}
