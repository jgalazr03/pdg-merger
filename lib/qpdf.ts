// Helpers client-only para proteger (cifrar) y quitar la contraseña de un PDF
// con QPDF compilado a WebAssembly (@neslinesli93/qpdf-wasm).
//
// IMPORTANTE: no importar desde un Server Component. El módulo depende de
// WebAssembly y del FS de Emscripten; se carga perezosamente la primera vez que
// se usa y el .wasm se sirve desde /public (ver scripts/copy-wasm.js y la config
// de webpack en next.config.js). Detalles en la memoria del proyecto:
// qpdf-wasm-password-tool.

// El .d.ts del paquete NO tipa FS.writeFile/FS.unlink (sí readFile), aunque
// existen en runtime (son del FS estándar de Emscripten). Tampoco tipa
// noInitialRun en las opciones. Declaramos lo que usamos y casteamos el factory.
interface QpdfFS {
  writeFile(path: string, data: Uint8Array): void;
  readFile(path: string): Uint8Array;
  unlink(path: string): void;
}
interface QpdfInstance {
  callMain(args: string[]): number;
  FS: QpdfFS;
}
interface QpdfOptions {
  locateFile: (path: string) => string;
  noInitialRun?: boolean;
}
type QpdfFactory = (opts: QpdfOptions) => Promise<QpdfInstance>;

let factoryPromise: Promise<QpdfFactory> | null = null;

function loadFactory(): Promise<QpdfFactory> {
  if (!factoryPromise) {
    factoryPromise = import('@neslinesli93/qpdf-wasm').then(
      (mod) => mod.default as unknown as QpdfFactory
    );
  }
  return factoryPromise;
}

// Instancia fresca por operación: tras `callMain` el runtime de Emscripten puede
// quedar inutilizable (main llama a exit), así que no se reutiliza entre
// llamadas. El .wasm queda cacheado por el navegador tras la primera descarga.
async function createInstance(): Promise<QpdfInstance> {
  const factory = await loadFactory();
  return factory({
    locateFile: () => '/qpdf.wasm',
    noInitialRun: true,
  });
}

/** Error específico de contraseña inválida al quitar la protección. */
export class WrongPasswordError extends Error {
  constructor() {
    super('Contraseña incorrecta');
    this.name = 'WrongPasswordError';
  }
}

const IN = '/in.pdf';
const OUT = '/out.pdf';

function call(qpdf: QpdfInstance, args: string[]): number {
  try {
    return qpdf.callMain(args);
  } catch (err) {
    // Emscripten lanza ExitStatus { status } cuando main llama a exit().
    const status = (err as { status?: number } | null)?.status;
    if (typeof status === 'number') return status;
    throw err;
  }
}

function cleanup(qpdf: QpdfInstance) {
  for (const path of [IN, OUT]) {
    try {
      qpdf.FS.unlink(path);
    } catch {
      // El archivo puede no existir (p. ej. operación fallida); no pasa nada.
    }
  }
}

// Owner password aleatorio: con AES-256, un owner vacío exigiría
// --allow-insecure y dejaría el PDF sin protección real. El usuario solo
// gestiona la contraseña de apertura; el owner se genera y se descarta.
function randomOwnerPassword(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

/**
 * Protege (cifra) un PDF con AES-256. `userPassword` es la contraseña que se
 * pedirá al abrir el documento.
 */
export async function protectPdf(
  file: File,
  userPassword: string,
  ownerPassword?: string
): Promise<Blob> {
  const qpdf = await createInstance();
  try {
    const owner =
      ownerPassword && ownerPassword.length > 0
        ? ownerPassword
        : randomOwnerPassword();
    const bytes = new Uint8Array(await file.arrayBuffer());
    qpdf.FS.writeFile(IN, bytes);
    const rc = call(qpdf, [
      IN,
      '--encrypt',
      userPassword,
      owner,
      '256', // AES-256
      '--print=full',
      '--modify=none',
      '--',
      OUT,
    ]);
    // 0 = ok, 3 = ok con advertencias.
    if (rc !== 0 && rc !== 3) {
      throw new Error(`No se pudo proteger el PDF (código ${rc}).`);
    }
    return new Blob([qpdf.FS.readFile(OUT)], { type: 'application/pdf' });
  } finally {
    cleanup(qpdf);
  }
}

/**
 * Quita la contraseña de un PDF cuando se conoce. Lanza `WrongPasswordError` si
 * la contraseña (de usuario o de propietario) es incorrecta.
 */
export async function unlockPdf(file: File, password: string): Promise<Blob> {
  const qpdf = await createInstance();
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    qpdf.FS.writeFile(IN, bytes);
    const rc = call(qpdf, ['--password=' + password, '--decrypt', IN, OUT]);
    if (rc === 2) throw new WrongPasswordError();
    if (rc !== 0 && rc !== 3) {
      throw new Error(`No se pudo quitar la contraseña (código ${rc}).`);
    }
    let out: Uint8Array;
    try {
      out = qpdf.FS.readFile(OUT);
    } catch {
      // Sin archivo de salida: la contraseña no abrió el documento.
      throw new WrongPasswordError();
    }
    return new Blob([out], { type: 'application/pdf' });
  } finally {
    cleanup(qpdf);
  }
}
