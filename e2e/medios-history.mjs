// Smoke e2e del historial de Medios contra `next dev` (http://localhost:3000).
// No descarga Whisper ni usa claves: sustituye el worker por uno falso y simula
// las APIs de IA. Comprueba que lo guardado se reutiliza SIN volver a llamar.
//
// Uso: npm run dev (en otra terminal) y luego `npm run e2e:medios`.
// Requiere Google Chrome instalado (playwright-core con channel 'chrome').
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

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
await page.getByRole('heading', { level: 1, name: 'junta-obra' }).waitFor({ timeout: 30000 });
await page.getByText('Guardada', { exact: true }).waitFor();
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
await page.getByRole('heading', { level: 1, name: 'junta-obra' }).waitFor({ timeout: 10000 });
// Un solo h1 (la grabación) y la ruta nombra el objeto.
assert.equal(await page.getByRole('heading', { level: 1 }).count(), 1, 'debe haber un solo h1');
await page.getByRole('navigation', { name: 'Ruta de navegación' }).getByText('junta-obra').waitFor();
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
// Sin audio, tocar un tiempo explica qué falta (no abre el Finder a ciegas);
// «Ahora no» cierra sin más.
await page.getByRole('button', { name: /0:00/ }).first().click();
const dialog = page.getByRole('dialog', { name: /Reconecta el audio para escuchar el 0:00/ });
await dialog.waitFor();
await dialog.getByRole('button', { name: 'Ahora no' }).click();
await dialog.waitFor({ state: 'detached' });
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

// 5. Tocar 0:01 → aviso → elegir el archivo: se reconecta y salta a ese momento.
await page.getByRole('button', { name: /0:01/ }).first().click();
const ask = page.getByRole('dialog', { name: /0:01/ });
await ask.waitFor();
const [chooser] = await Promise.all([
  page.waitForEvent('filechooser'),
  ask.getByRole('button', { name: 'Seleccionar archivo' }).click(),
]);
await chooser.setFiles({ name: 'junta-obra.wav', mimeType: 'audio/wav', buffer: silentWav() });
await page.locator('audio').waitFor();
await page.waitForFunction(() => Math.abs(document.querySelector('audio').currentTime - 1) < 0.25);
step('aviso de reconexión y salto al momento pedido');

// 6. Lista de recientes: aparece con insignias; borrar y deshacer.
// La herramienta en la ruta vuelve al inicio (y la URL deja de apuntar a la sesión).
await page.getByRole('navigation', { name: 'Ruta de navegación' }).getByRole('link', { name: 'Transcribir' }).click();
await page.waitForFunction(() => !new URL(location.href).searchParams.has('s'));
await page.getByText('Selecciona un audio o video').waitFor();
const recent = page.getByRole('region', { name: 'Transcripciones recientes' });
await recent.getByText('junta-obra').waitFor();
await recent.getByText('Resumen').waitFor();
await recent.getByRole('button', { name: 'Eliminar junta-obra' }).click();
await recent.getByText(/Aquí aparecerán/).waitFor();
await page.getByRole('button', { name: 'Deshacer' }).click();
await recent.getByText('junta-obra').waitFor();
step('borrar y deshacer');

// 7. Sin voz reconocida: error explicado, sin resultado vacío ni sesión guardada.
const emptyPage = await context.newPage();
await emptyPage.route('**/transcribe-worker.js', (r) =>
  r.fulfill({
    contentType: 'text/javascript',
    body: `self.onmessage = () => self.postMessage({ status: 'complete', text: '', chunks: [] });`,
  })
);
await emptyPage.goto(`${BASE}/transcribir`, { waitUntil: 'networkidle' });
const before = await emptyPage.evaluate(() => new Promise((res) => {
  const req = indexedDB.open('gainco-medios');
  req.onsuccess = () => { const c = req.result.transaction('sessions').objectStore('sessions').count(); c.onsuccess = () => res(c.result); };
}));
await emptyPage.setInputFiles('input[type=file]', { name: 'mudo.wav', mimeType: 'audio/wav', buffer: silentWav() });
await emptyPage.getByRole('button', { name: 'Transcribir', exact: true }).click();
await emptyPage.getByText('No se reconoció voz en esta grabación').waitFor({ timeout: 30000 });
await emptyPage.waitForTimeout(500);
const after = await emptyPage.evaluate(() => new Promise((res) => {
  const req = indexedDB.open('gainco-medios');
  req.onsuccess = () => { const c = req.result.transaction('sessions').objectStore('sessions').count(); c.onsuccess = () => res(c.result); };
}));
assert.equal(after, before, 'una transcripción vacía no debe guardarse');
await emptyPage.close();
step('transcripción sin voz: error explicado y nada guardado');

// 8. Archivo que el navegador no puede decodificar (como un .mov en iPhone):
// se ofrece el servidor con un botón (consentimiento explícito) y el modo
// elegido se recuerda al volver.
const movPage = await context.newPage();
await movPage.route('**/api/blob-upload', (r) => r.fulfill({ status: 500, json: { error: 'sin blob en e2e' } }));
await movPage.goto(`${BASE}/transcribir`, { waitUntil: 'networkidle' });
await movPage.evaluate(() => localStorage.removeItem('gainco:transcribe-mode'));
await movPage.reload({ waitUntil: 'networkidle' });
await movPage.setInputFiles('input[type=file]', {
  name: 'Act02video.mov', mimeType: 'video/quicktime', buffer: Buffer.from('no es un video de verdad'),
});
await movPage.getByRole('button', { name: /En tu navegador/ }).click();
await movPage.getByRole('button', { name: 'Transcribir', exact: true }).click();
await movPage.getByText(/no puede leer el audio de este archivo/).waitFor({ timeout: 30000 });
await movPage.getByRole('button', { name: 'Transcribir en el servidor' }).click();
await movPage.waitForFunction(() =>
  [...document.querySelectorAll('button[aria-pressed="true"]')].some((b) => b.textContent.includes('En el servidor'))
);
await movPage.reload({ waitUntil: 'networkidle' });
await movPage.setInputFiles('input[type=file]', { name: 'otro.wav', mimeType: 'audio/wav', buffer: silentWav() });
await movPage.waitForFunction(() =>
  [...document.querySelectorAll('button[aria-pressed="true"]')].some((b) => b.textContent.includes('En el servidor'))
);
await movPage.close();
step('archivo ilegible en el navegador: botón al servidor y modo recordado');

// 9. Video sin pista de audio (grabación de pantalla sin micrófono): se avisa al
// elegirlo y no se ofrece transcribir; un video con audio sí se puede.
const fixtures = new URL('../lib/__fixtures__/', import.meta.url);
const naPage = await context.newPage();
await naPage.goto(`${BASE}/transcribir`, { waitUntil: 'networkidle' });
await naPage.setInputFiles('input[type=file]', fileURLToPath(new URL('video-sin-audio.mov', fixtures)));
await naPage.getByText('Este video no tiene audio.').waitFor();
assert.equal(await naPage.getByRole('button', { name: 'Transcribir', exact: true }).count(), 0);
await naPage.getByRole('button', { name: 'Cambiar archivo' }).click();
await naPage.setInputFiles('input[type=file]', fileURLToPath(new URL('video-con-audio.mov', fixtures)));
await naPage.getByRole('button', { name: 'Transcribir', exact: true }).waitFor();
assert.equal(await naPage.getByText('Este video no tiene audio.').count(), 0);
await naPage.close();
step('video sin audio: aviso al elegirlo, sin opción de transcribir');

await page.screenshot({ path: process.env.E2E_SHOT ?? 'e2e-medios-history.png' });
await browser.close();
console.log('OK: historial de Medios');
