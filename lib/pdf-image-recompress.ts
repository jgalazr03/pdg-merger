// Compresión de PDF que conserva la estructura del documento: en vez de
// renderizar cada página y guardarla como imagen (lo que pierde texto, enlaces
// y formularios, y degrada dos veces), se reduce la resolución de las imágenes
// JPEG incrustadas «en su sitio». El resto del PDF no se toca.
//
// Pensado para el caso dominante en GAINCO: escaneos de Google Drive, donde
// cada página es una sola imagen JPEG RGB que ocupa ~99.9 % del archivo. En
// esos archivos recodificar a la misma resolución casi no ahorra (~5 %): la
// ganancia real viene de bajar los píxeles, así que el nivel se define por el
// lado mayor de la imagen (maxEdge), no por una escala relativa.
//
// Este módulo no depende del DOM: la decodificación/recodificación se inyecta
// (`resample`) para poder probarlo en Node. La versión de navegador está en
// lib/jpeg-resample.ts.

import type { PDFDict, PDFDocument, PDFObject, PDFRef } from 'pdf-lib';

export interface ResampleRequest {
  /** JPEG original, sin segmentos EXIF (ver stripExif). */
  jpeg: Uint8Array;
  /** Dimensiones declaradas en el PDF. */
  width: number;
  height: number;
  /** Dimensiones de salida (nunca mayores que las de entrada). */
  targetWidth: number;
  targetHeight: number;
  /** Calidad JPEG 0-1. */
  quality: number;
}

/** Devuelve el JPEG recodificado (siempre RGB de 3 componentes), o null si no pudo. */
export type ResampleFn = (req: ResampleRequest) => Promise<Uint8Array | null>;

export interface RecompressOptions {
  /** Lado mayor máximo de cada imagen, en píxeles. */
  maxEdge: number;
  /** Calidad JPEG 0-1. */
  quality: number;
  resample: ResampleFn;
  onProgress?: (done: number, total: number) => void;
}

export interface RecompressResult {
  bytes: Uint8Array;
  /** Imágenes JPEG candidatas encontradas. */
  candidates: number;
  /** Imágenes efectivamente sustituidas. */
  replaced: number;
}

// Una imagen solo se sustituye si la nueva pesa al menos un 10 % menos: por
// debajo de eso no compensa la pérdida de una segunda codificación JPEG.
const MIN_GAIN = 0.9;
// Las imágenes pequeñas (logos, sellos) no mueven el peso y sí se notan.
const MIN_BYTES = 20 * 1024;

/**
 * Quita los segmentos APP1 (EXIF/XMP) de un JPEG. Los visores de PDF ignoran
 * la orientación EXIF, pero el navegador la aplica al decodificar: sin esto,
 * una imagen con orientación EXIF saldría girada tras recodificarla.
 */
export function stripExif(jpeg: Uint8Array): Uint8Array {
  if (jpeg.length < 4 || jpeg[0] !== 0xff || jpeg[1] !== 0xd8) return jpeg;
  const keep: Array<[number, number]> = [[0, 2]];
  let pos = 2;
  let removed = false;
  while (pos + 4 <= jpeg.length) {
    if (jpeg[pos] !== 0xff) return jpeg; // estructura inesperada: no tocar
    const marker = jpeg[pos + 1];
    // SOS: a partir de aquí van los datos comprimidos; se copia el resto tal cual.
    if (marker === 0xda) break;
    const length = (jpeg[pos + 2] << 8) | jpeg[pos + 3];
    if (length < 2 || pos + 2 + length > jpeg.length) return jpeg;
    if (marker === 0xe1) removed = true;
    else keep.push([pos, pos + 2 + length]);
    pos += 2 + length;
  }
  if (!removed) return jpeg;
  keep.push([pos, jpeg.length]);
  const out = new Uint8Array(keep.reduce((n, [a, b]) => n + (b - a), 0));
  let offset = 0;
  for (const [a, b] of keep) {
    out.set(jpeg.subarray(a, b), offset);
    offset += b - a;
  }
  return out;
}

/** Dimensiones de salida para que el lado mayor no pase de maxEdge (sin ampliar). */
export function targetSize(width: number, height: number, maxEdge: number) {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

type PdfLib = typeof import('pdf-lib');

interface Candidate {
  ref: PDFRef;
  dict: PDFDict;
  contents: Uint8Array;
  width: number;
  height: number;
  /** DeviceGray: tras recodificar (salida RGB) hay que declarar DeviceRGB. */
  gray: boolean;
}

function numberOf(lib: PdfLib, dict: PDFDict, key: string): number | null {
  const value = dict.lookup(lib.PDFName.of(key));
  return value instanceof lib.PDFNumber ? value.asNumber() : null;
}

// Solo se aceptan imágenes que el navegador reproduce muestra a muestra:
// JPEG de 8 bits en DeviceRGB/DeviceGray o ICCBased de 3 componentes (el perfil
// del PDF se conserva y se sigue aplicando sobre las mismas muestras). CMYK,
// indexadas, máscaras, /Decode y demás se dejan intactas.
function asCandidate(lib: PdfLib, doc: PDFDocument, ref: PDFRef, obj: PDFObject): Candidate | null {
  const { PDFName, PDFArray, PDFRawStream, PDFBool } = lib;
  if (!(obj instanceof PDFRawStream)) return null;
  const dict = obj.dict;
  if (dict.lookup(PDFName.of('Subtype')) !== PDFName.of('Image')) return null;

  const filter = dict.lookup(PDFName.of('Filter'));
  const filterName =
    filter instanceof PDFArray && filter.size() === 1 ? filter.lookup(0) : filter;
  if (filterName !== PDFName.of('DCTDecode')) return null;

  if (dict.has(PDFName.of('DecodeParms')) || dict.has(PDFName.of('Decode'))) return null;
  if (dict.lookup(PDFName.of('ImageMask')) === PDFBool.True) return null;
  // Máscara por color clave: no sobrevive a una recodificación con pérdida.
  if (dict.lookup(PDFName.of('Mask')) instanceof PDFArray) return null;
  if (numberOf(lib, dict, 'BitsPerComponent') !== 8) return null;

  const width = numberOf(lib, dict, 'Width');
  const height = numberOf(lib, dict, 'Height');
  if (!width || !height) return null;

  const colorSpace = dict.lookup(PDFName.of('ColorSpace'));
  let gray = false;
  if (colorSpace === PDFName.of('DeviceGray')) {
    gray = true;
  } else if (colorSpace instanceof PDFArray) {
    if (colorSpace.lookup(0) !== PDFName.of('ICCBased')) return null;
    const profile = colorSpace.lookup(1);
    if (!(profile instanceof PDFRawStream)) return null;
    if (numberOf(lib, profile.dict, 'N') !== 3) return null;
  } else if (colorSpace !== PDFName.of('DeviceRGB')) {
    return null;
  }

  const contents = obj.contents;
  if (contents.length < MIN_BYTES) return null;
  return { ref, dict, contents, width, height, gray };
}

/**
 * Reduce las imágenes JPEG incrustadas de un PDF conservando todo lo demás.
 * Lanza si pdf-lib no puede abrir el archivo (p. ej. cifrado): quien llama
 * decide el respaldo.
 */
export async function recompressPdfImages(
  input: Uint8Array,
  { maxEdge, quality, resample, onProgress }: RecompressOptions
): Promise<RecompressResult> {
  const lib = await import('pdf-lib');
  const doc = await lib.PDFDocument.load(input, { updateMetadata: false });
  const { context } = doc;

  const candidates: Candidate[] = [];
  for (const [ref, obj] of context.enumerateIndirectObjects()) {
    const candidate = asCandidate(lib, doc, ref, obj);
    if (candidate) candidates.push(candidate);
  }

  let replaced = 0;
  for (let i = 0; i < candidates.length; i++) {
    const { ref, dict, contents, width, height, gray } = candidates[i];
    const target = targetSize(width, height, maxEdge);
    let output: Uint8Array | null = null;
    try {
      output = await resample({
        jpeg: stripExif(contents),
        width,
        height,
        targetWidth: target.width,
        targetHeight: target.height,
        quality,
      });
    } catch {
      output = null; // imagen ilegible para el navegador: se queda la original
    }

    if (output && output.length < contents.length * MIN_GAIN) {
      const next = dict.clone(context);
      next.set(lib.PDFName.of('Width'), context.obj(target.width));
      next.set(lib.PDFName.of('Height'), context.obj(target.height));
      next.set(lib.PDFName.of('Filter'), lib.PDFName.of('DCTDecode'));
      if (gray) next.set(lib.PDFName.of('ColorSpace'), lib.PDFName.of('DeviceRGB'));
      context.assign(ref, lib.PDFRawStream.of(next, output));
      replaced++;
    }
    onProgress?.(i + 1, candidates.length);
  }

  if (replaced === 0) return { bytes: input, candidates: candidates.length, replaced };
  const bytes = await doc.save();
  return { bytes, candidates: candidates.length, replaced };
}
