// Remuestreo de JPEG en el navegador para lib/pdf-image-recompress.ts.
// Client-only: usa createImageBitmap y canvas.

import type { ResampleFn } from './pdf-image-recompress';

type AnyCanvas = OffscreenCanvas | HTMLCanvasElement;

function createCanvas(width: number, height: number): AnyCanvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function draw(source: CanvasImageSource, width: number, height: number): AnyCanvas {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d') as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null;
  if (!ctx) throw new Error('Sin contexto 2D');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, width, height);
  return canvas;
}

function toJpeg(canvas: AnyCanvas, quality: number): Promise<Blob | null> {
  if ('convertToBlob' in canvas) {
    return canvas.convertToBlob({ type: 'image/jpeg', quality });
  }
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
}

export const resampleJpegInBrowser: ResampleFn = async ({
  jpeg,
  width,
  height,
  targetWidth,
  targetHeight,
  quality,
}) => {
  // colorSpaceConversion 'none': se conservan las muestras tal cual, sin
  // convertir por un perfil ICC incrustado en el JPEG (el PDF ya declara el suyo).
  const bitmap = await createImageBitmap(new Blob([jpeg], { type: 'image/jpeg' }), {
    colorSpaceConversion: 'none',
  });
  try {
    // Si el navegador entrega otras dimensiones que las declaradas en el PDF
    // (JPEG inconsistente o girado), no es seguro sustituir la imagen.
    if (bitmap.width !== width || bitmap.height !== height) return null;

    // Reducir a menos de la mitad de un solo paso produce aliasing: se baja por
    // mitades hasta quedar a menos de 2x del tamaño final.
    let source: CanvasImageSource = bitmap;
    let w = width;
    let h = height;
    while (w / 2 >= targetWidth && h / 2 >= targetHeight) {
      w = Math.round(w / 2);
      h = Math.round(h / 2);
      source = draw(source, w, h);
    }
    const canvas = draw(source, targetWidth, targetHeight);
    const blob = await toJpeg(canvas, quality);
    if (!blob) return null;
    return new Uint8Array(await blob.arrayBuffer());
  } finally {
    bitmap.close();
  }
};
