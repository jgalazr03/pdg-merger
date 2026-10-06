// ¿El archivo trae pista de audio? Para MP4/MOV/M4A (ISO BMFF / QuickTime) se
// lee solo la estructura del contenedor —cabeceras de 8–16 bytes y la caja
// `moov`, normalmente de pocos KB— sin cargar el video en memoria. Una grabación
// de pantalla de macOS sin micrófono, por ejemplo, es solo video: no hay voz
// que transcribir y conviene decirlo antes de decodificar o subir 150 MB.

/** Lo mínimo de `File`/`Blob` que se usa (facilita los tests). */
type Sliceable = Pick<Blob, 'size' | 'slice'>;

const MAX_MOOV_BYTES = 64 * 1024 * 1024;

async function readBytes(file: Sliceable, start: number, end: number): Promise<Uint8Array> {
  return new Uint8Array(await file.slice(start, end).arrayBuffer());
}

function fourcc(b: Uint8Array, at: number): string {
  return String.fromCharCode(b[at], b[at + 1], b[at + 2], b[at + 3]);
}

/** Ubica la caja `moov` recorriendo solo las cajas de primer nivel. */
async function findMoov(file: Sliceable): Promise<{ start: number; size: number } | null> {
  let pos = 0;
  let first = true;
  while (pos + 8 <= file.size) {
    const h = await readBytes(file, pos, Math.min(pos + 16, file.size));
    const view = new DataView(h.buffer, h.byteOffset, h.byteLength);
    let size = view.getUint32(0);
    const type = fourcc(h, 4);
    // El primer átomo de un MP4/MOV es `ftyp` (o en QuickTime antiguo,
    // `wide`/`mdat`/`moov`/`free`). Si no, no es este formato.
    if (first && !['ftyp', 'wide', 'mdat', 'moov', 'free', 'skip'].includes(type)) {
      return null;
    }
    first = false;
    let header = 8;
    if (size === 1) {
      if (h.byteLength < 16) return null;
      size = Number(view.getBigUint64(8));
      header = 16;
    } else if (size === 0) {
      size = file.size - pos;
    }
    if (size < header) return null; // estructura corrupta
    if (type === 'moov') return { start: pos, size };
    pos += size;
  }
  return null;
}

/**
 * true/false si se pudo determinar; null si no es un contenedor MP4/MOV o no se
 * pudo leer (MP3, WAV, OGG… o un archivo dañado): en ese caso no se bloquea
 * nada y decide el decodificador o el servidor.
 */
export async function probeHasAudio(file: Sliceable): Promise<boolean | null> {
  try {
    const moov = await findMoov(file);
    if (!moov || moov.size > MAX_MOOV_BYTES) return null;
    const b = await readBytes(file, moov.start, moov.start + moov.size);
    // Cada pista declara su tipo en una caja `hdlr`:
    // [size][hdlr][version+flags 4][pre_defined 4][handler_type 4] → 'soun' = audio.
    let tracks = 0;
    for (let i = 4; i + 16 <= b.length; i++) {
      if (b[i] === 0x68 && fourcc(b, i) === 'hdlr') {
        const handler = fourcc(b, i + 12);
        if (handler === 'soun') return true;
        if (handler === 'vide') tracks++;
      }
    }
    // Sin ninguna pista de audio. Si ni siquiera hubo pistas reconocibles, no
    // afirmamos nada.
    return tracks > 0 ? false : null;
  } catch {
    return null;
  }
}
