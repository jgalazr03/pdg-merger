// Smoke e2e del historial de Medios contra `next dev` (http://localhost:3000).
// No descarga Whisper ni usa claves: sustituye el worker por uno falso y simula
// las APIs de IA. Comprueba que lo guardado se reutiliza SIN volver a llamar.
//
// Uso: npm run dev (en otra terminal) y luego `npm run e2e:medios`.
// Requiere Google Chrome instalado (playwright-core con channel 'chrome').
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

const FAKE_WORKER = `
self.onmessage = () => {
  self.postMessage({ status: 'loading-model' });
  self.postMessage({ status: 'transcribing' });
  self.postMessage({ status: 'complete', text: '', chunks: [
    { timestamp: [0, 1], text: 'Buenos días, revisemos la obra.' },
    { timestamp: [1, 2], text: 'El presupuesto subió un diez por ciento.' },
  ]});
};`;

/** WAV PCM de 2 s en silencio: decodificable por WebAudio en cualquier navegador. */
function silentWav(seconds = 2, rate = 16000) {
  const n = seconds * rate;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22); buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28);
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36);
  buf.writeUInt32LE(n * 2, 40);
  return buf;
}

const MINUTA = {
  titulo: 'Revisión de obra',
  resumen: 'Se revisó el avance y el presupuesto.',
  puntosClave: ['El presupuesto subió 10%'],
  acuerdos: [],
  tareas: [],
};

const browser = await chromium.launch({ channel: 'chrome' });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

const apiCalls = [];
await page.route('**/transcribe-worker.js', (r) =>
  r.fulfill({ contentType: 'text/javascript', body: FAKE_WORKER })
);
await page.route('**/api/**', (r) => {
  const path = new URL(r.request().url()).pathname;
  apiCalls.push(path);
  const bodies = {
    '/api/summarize': { minuta: MINUTA, truncated: false },
    '/api/suggestions': { questions: ['¿Cuánto subió el presupuesto?'] },
    '/api/chapters': { chapters: [{ time: 0, title: 'Inicio', summary: 'Arranque' }] },
  };
  return r.fulfill({ json: bodies[path] ?? { error: 'no simulado' }, status: bodies[path] ? 200 : 500 });
});

const step = (msg) => console.log(`· ${msg}`);

// 1. Transcribir (worker falso) → se crea la sesión.
await page.goto(`${BASE}/transcribir`, { waitUntil: 'networkidle' });
await page.evaluate(() => new Promise((res) => {
  const req = indexedDB.deleteDatabase('gainco-medios');
  req.onsuccess = req.onerror = req.onblocked = () => res();
}));
await page.reload({ waitUntil: 'networkidle' });
await page.setInputFiles('input[type=file]', {
  name: 'junta-obra.wav', mimeType: 'audio/wav', buffer: silentWav(),
});
await page.getByRole('button', { name: 'Transcribir', exact: true }).click();
await page.getByText('Guardada en este equipo').waitFor({ timeout: 30000 });
await page.waitForFunction(() => new URL(location.href).searchParams.has('s'));
const sessionId = new URL(page.url()).searchParams.get('s');
step(`sesión creada ${sessionId}`);

// 2. Generar resumen y capítulos (se guardan).
await page.getByRole('tab', { name: /Resumen/ }).click();
await page.getByRole('button', { name: 'Generar resumen' }).click();
await page.getByText('Revisión de obra').waitFor();
await page.getByRole('tab', { name: /Capítulos/ }).click();
await page.getByRole('button', { name: 'Generar capítulos' }).click();
await page.getByText('Arranque').waitFor();
await page.waitForTimeout(300);
step('resumen y capítulos generados');

// 3. Recargar: la sesión se reabre con sus resultados y SIN llamadas a la API.
apiCalls.length = 0;
await page.reload({ waitUntil: 'networkidle' });
await page.getByText('Guardada en este equipo').waitFor({ timeout: 10000 });
// Jerarquía: en el resultado no quedan los elementos de antes de subir, y las
// 6 pestañas de IA son visibles completas (no recortadas por el panel).
assert.equal(await page.getByText('Formatos y límites').count(), 0, 'sobra «Formatos y límites»');
const tablist = page.getByRole('tablist', { name: 'Herramientas de la grabación' });
const listBox = await tablist.boundingBox();
for (const tab of await tablist.getByRole('tab').all()) {
  const b = await tab.boundingBox();
  assert.ok(b && b.x + b.width <= listBox.x + listBox.width + 1, 'pestaña recortada');
}
assert.equal(await tablist.getByRole('tab').count(), 6);
await page.getByRole('tab', { name: /Resumen/ }).click();
await page.getByText('Revisión de obra').waitFor();
await page.getByRole('tab', { name: /Capítulos/ }).click();
await page.getByText('Arranque').waitFor();
await page.getByRole('button', { name: 'Reconectar audio' }).waitFor();
// Sin audio, tocar un tiempo pide reconectarlo (abre el selector de archivo).
const [chooser] = await Promise.all([
  page.waitForEvent('filechooser'),
  page.getByRole('button', { name: /0:00/ }).first().click(),
]);
assert.ok(chooser, 'tocar un tiempo sin audio debía abrir el selector');
assert.deepEqual(apiCalls, [], `no debía llamar a la API: ${apiCalls.join(', ')}`);
step('recarga: resultados reutilizados sin API');

// 4. Corregir el texto marca el resumen como desactualizado (y persiste).
const firstRow = page.getByText('Buenos días, revisemos la obra.').first();
await firstRow.click();
await page.keyboard.press('End');
await page.keyboard.type(' Corregido');
await page.locator('body').click({ position: { x: 5, y: 5 } });
await page.getByRole('tab', { name: /Resumen/ }).click();
await page.locator('p:has-text("Se generó antes de tus últimos cambios"):visible').waitFor();
await page.waitForTimeout(800); // debounce de 500 ms
await page.reload({ waitUntil: 'networkidle' });
await page.getByText('Corregido').first().waitFor();
await page.getByRole('tab', { name: /Resumen/ }).click();
await page.locator('p:has-text("Se generó antes de tus últimos cambios"):visible').waitFor();
step('edición persistida y resumen marcado como desactualizado');

// 5. Reconectar el audio con la misma huella.
await page.setInputFiles('input[type=file][accept]', {
  name: 'junta-obra.wav', mimeType: 'audio/wav', buffer: silentWav(),
});
await page.locator('audio').waitFor();
step('audio reconectado');

// 6. Lista de recientes: aparece con insignias; borrar y deshacer.
await page.getByRole('button', { name: 'Nueva grabación' }).click();
const recent = page.getByRole('region', { name: 'Transcripciones recientes' });
await recent.getByText('junta-obra').waitFor();
await recent.getByText('Resumen').waitFor();
await recent.getByRole('button', { name: 'Eliminar junta-obra' }).click();
await recent.getByText(/Aquí aparecerán/).waitFor();
await page.getByRole('button', { name: 'Deshacer' }).click();
await recent.getByText('junta-obra').waitFor();
step('borrar y deshacer');

await page.screenshot({ path: process.env.E2E_SHOT ?? 'e2e-medios-history.png' });
await browser.close();
console.log('OK: historial de Medios');
