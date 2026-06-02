// Copia los assets de tesseract.js a public/tesseract/ para servirlos en runtime
// (worker/core/lang autoalojados; sin depender de CDN externa — privacidad).
// Se ejecuta en `predev` y `prebuild`. NO importar estos binarios por el bundler
// (dispara el bug entryOptions.layer del App Router en Next 13.5.1); se sirven
// como estáticos y tesseract.js los hace fetch en runtime via workerPath/
// corePath/langPath. public/tesseract/ está en .gitignore (lo genera este
// script en cada dev/build, también en Vercel).
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const outDir = path.join(root, 'public', 'tesseract');
const coreDir = path.join(outDir, 'core');
const langDir = path.join(outDir, 'lang');

function copy(src, dest) {
  fs.copyFileSync(src, dest);
}

try {
  fs.mkdirSync(coreDir, { recursive: true });
  fs.mkdirSync(langDir, { recursive: true });

  // Worker del navegador.
  copy(
    path.join(root, 'node_modules', 'tesseract.js', 'dist', 'worker.min.js'),
    path.join(outDir, 'worker.min.js')
  );

  // Core: TODAS las variantes *.wasm.js (el navegador elige SIMD/LSTM según el
  // dispositivo; copiar solo algunas hace 404 la que falte y rompe en runtime).
  const coreSrc = path.join(root, 'node_modules', 'tesseract.js-core');
  const coreFiles = fs
    .readdirSync(coreSrc)
    .filter((f) => f.endsWith('.wasm.js'));
  if (coreFiles.length === 0) {
    throw new Error('no se encontraron *.wasm.js en tesseract.js-core');
  }
  coreFiles.forEach((f) => copy(path.join(coreSrc, f), path.join(coreDir, f)));

  // Modelo de español (best_int: ~2 MB, buena precisión y descarga ligera).
  copy(
    path.join(
      root,
      'node_modules',
      '@tesseract.js-data',
      'spa',
      '4.0.0_best_int',
      'spa.traineddata.gz'
    ),
    path.join(langDir, 'spa.traineddata.gz')
  );

  console.log(
    `[copy-tesseract] worker + ${coreFiles.length} core + spa.traineddata.gz -> public/tesseract/`
  );
} catch (err) {
  console.error('[copy-tesseract] Error:', err.message);
  process.exit(1);
}
