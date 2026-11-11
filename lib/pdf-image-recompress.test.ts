import sharp from 'sharp';
import { PDFDocument, PDFName, PDFNumber, PDFRawStream, StandardFonts } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import {
  recompressPdfImages,
  stripExif,
  targetSize,
  type ResampleFn,
} from './pdf-image-recompress';

// Equivalente en Node del remuestreo del navegador (lib/jpeg-resample.ts).
const sharpResample: ResampleFn = async ({ jpeg, targetWidth, targetHeight, quality }) =>
  new Uint8Array(
    await sharp(jpeg)
      .resize(targetWidth, targetHeight, { fit: 'fill' })
      .toColourspace('srgb')
      .jpeg({ quality: Math.round(quality * 100) })
      .toBuffer()
  );

// «Escaneo» sintético: ruido (para que el JPEG pese) del tamaño pedido.
async function noiseJpeg(width: number, height: number, gray = false): Promise<Uint8Array> {
  const channels = gray ? 1 : 3;
  const raw = Buffer.alloc(width * height * channels);
  let seed = 7;
  for (let i = 0; i < raw.length; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    raw[i] = seed >> 16;
  }
  let image = sharp(raw, { raw: { width, height, channels } });
  // Sin esto sharp escribe un JPEG de 3 componentes aunque la entrada sea de 1.
  if (gray) image = image.toColourspace('b-w');
  return new Uint8Array(await image.jpeg({ quality: 90 }).toBuffer());
}

async function scanPdf(pages: number, width: number, height: number, gray = false) {
  const doc = await PDFDocument.create();
  const jpeg = await noiseJpeg(width, height, gray);
  for (let i = 0; i < pages; i++) {
    // Copia distinta por página, como en un escaneo real (una imagen por página).
    const image = await doc.embedJpg(jpeg.slice());
    const page = doc.addPage([612, 792]);
    page.drawImage(image, { x: 0, y: 0, width: 612, height: 792 });
  }
  return doc;
}

async function images(bytes: Uint8Array) {
  const doc = await PDFDocument.load(bytes);
  const found: Array<{ width: number; height: number; colorSpace: string; data: Uint8Array }> = [];
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream)) continue;
    if (obj.dict.lookup(PDFName.of('Subtype')) !== PDFName.of('Image')) continue;
    found.push({
      width: obj.dict.lookup(PDFName.of('Width'), PDFNumber).asNumber(),
      height: obj.dict.lookup(PDFName.of('Height'), PDFNumber).asNumber(),
      colorSpace: String(obj.dict.lookup(PDFName.of('ColorSpace'))),
      data: obj.contents,
    });
  }
  return { doc, found };
}

describe('targetSize', () => {
  it('reduce el lado mayor al tope conservando la proporción', () => {
    expect(targetSize(2284, 2922, 1650)).toEqual({ width: 1290, height: 1650 });
    expect(targetSize(2809, 2241, 1650)).toEqual({ width: 1650, height: 1316 });
  });

  it('nunca amplía', () => {
    expect(targetSize(800, 600, 1650)).toEqual({ width: 800, height: 600 });
  });
});

describe('stripExif', () => {
  const segment = (marker: number, payload: number[]) => [
    0xff,
    marker,
    (payload.length + 2) >> 8,
    (payload.length + 2) & 0xff,
    ...payload,
  ];
  const tail = [0xff, 0xda, 0x00, 0x02, 0x11, 0x22, 0xff, 0xd9];

  it('quita APP1 y conserva el resto en orden', () => {
    const jpeg = new Uint8Array([
      0xff, 0xd8,
      ...segment(0xe0, [1, 2, 3]),
      ...segment(0xe1, [9, 9, 9, 9]),
      ...segment(0xdb, [4, 5]),
      ...tail,
    ]);
    expect(Array.from(stripExif(jpeg))).toEqual([
      0xff, 0xd8,
      ...segment(0xe0, [1, 2, 3]),
      ...segment(0xdb, [4, 5]),
      ...tail,
    ]);
  });

  it('sin APP1 devuelve el mismo arreglo', () => {
    const jpeg = new Uint8Array([0xff, 0xd8, ...segment(0xe0, [1]), ...tail]);
    expect(stripExif(jpeg)).toBe(jpeg);
  });

  it('un JPEG real sigue siendo decodificable tras quitarle el EXIF', async () => {
    const withExif = await sharp(Buffer.from(await noiseJpeg(64, 48)))
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer();
    const stripped = stripExif(new Uint8Array(withExif));
    expect(stripped.length).toBeLessThan(withExif.length);
    const meta = await sharp(stripped).metadata();
    expect([meta.width, meta.height, meta.orientation]).toEqual([64, 48, undefined]);
  });
});

describe('recompressPdfImages', () => {
  it('reduce las imágenes de un escaneo y conserva páginas y tamaño de página', async () => {
    const input = await (await scanPdf(3, 1100, 1400)).save();
    const result = await recompressPdfImages(input, {
      maxEdge: 700,
      quality: 0.8,
      resample: sharpResample,
    });

    expect(result).toMatchObject({ candidates: 3, replaced: 3 });
    expect(result.bytes.length).toBeLessThan(input.length * 0.6);

    const { doc, found } = await images(result.bytes);
    expect(doc.getPageCount()).toBe(3);
    expect(doc.getPage(0).getSize()).toEqual({ width: 612, height: 792 });
    expect(found).toHaveLength(3);
    for (const image of found) {
      expect([image.width, image.height]).toEqual([550, 700]);
      const meta = await sharp(image.data).metadata();
      expect([meta.width, meta.height]).toEqual([550, 700]);
    }
  });

  it('conserva el texto del documento', async () => {
    const doc = await scanPdf(1, 1100, 1400);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    doc.getPage(0).drawText('Remision R11555', { x: 40, y: 700, size: 12, font });
    const input = await doc.save({ useObjectStreams: false });

    const { bytes, replaced } = await recompressPdfImages(input, {
      maxEdge: 700,
      quality: 0.8,
      resample: sharpResample,
    });
    expect(replaced).toBe(1);

    const out = await PDFDocument.load(bytes);
    const fonts = out.getPage(0).node.Resources()?.lookup(PDFName.of('Font'));
    expect(fonts).toBeDefined();
    // El contenido de la página (operadores de texto incluidos) no se toca.
    const before = await PDFDocument.load(input);
    expect(out.getPage(0).node.Contents()?.toString()).toBe(
      before.getPage(0).node.Contents()?.toString()
    );
  });

  it('una imagen en grises queda declarada como DeviceRGB', async () => {
    const input = await (await scanPdf(1, 1100, 1400, true)).save();
    expect((await images(input)).found[0].colorSpace).toBe('/DeviceGray');

    const { bytes, replaced } = await recompressPdfImages(input, {
      maxEdge: 700,
      quality: 0.8,
      resample: sharpResample,
    });
    expect(replaced).toBe(1);
    const [image] = (await images(bytes)).found;
    expect(image.colorSpace).toBe('/DeviceRGB');
    expect((await sharp(image.data).metadata()).channels).toBe(3);
  });

  it('si no hay ganancia suficiente devuelve el original intacto', async () => {
    const input = await (await scanPdf(1, 1100, 1400)).save();
    // Remuestreo que no ahorra nada: devuelve el mismo JPEG.
    const result = await recompressPdfImages(input, {
      maxEdge: 5000,
      quality: 0.8,
      resample: async ({ jpeg }) => jpeg,
    });
    expect(result.replaced).toBe(0);
    expect(result.bytes).toBe(input);
  });

  it('si el remuestreo falla o devuelve null, la imagen se queda como estaba', async () => {
    const input = await (await scanPdf(2, 1100, 1400)).save();
    let call = 0;
    const result = await recompressPdfImages(input, {
      maxEdge: 700,
      quality: 0.8,
      resample: async (req) => {
        call++;
        if (call === 1) throw new Error('no decodifica');
        return null;
      },
    });
    expect(result).toMatchObject({ candidates: 2, replaced: 0 });
    expect(result.bytes).toBe(input);
  });

  it('ignora imágenes que no son JPEG (PNG) y PDFs sin imágenes', async () => {
    const doc = await PDFDocument.create();
    const png = await sharp({
      create: { width: 600, height: 600, channels: 3, background: '#336699' },
    })
      .png()
      .toBuffer();
    const image = await doc.embedPng(png);
    doc.addPage([612, 792]).drawImage(image, { x: 0, y: 0, width: 300, height: 300 });
    const input = await doc.save();

    const result = await recompressPdfImages(input, {
      maxEdge: 100,
      quality: 0.5,
      resample: sharpResample,
    });
    expect(result).toMatchObject({ candidates: 0, replaced: 0 });
    expect(result.bytes).toBe(input);
  });

  it('informa el progreso por imagen', async () => {
    const input = await (await scanPdf(3, 1100, 1400)).save();
    const seen: string[] = [];
    await recompressPdfImages(input, {
      maxEdge: 700,
      quality: 0.8,
      resample: sharpResample,
      onProgress: (done, total) => seen.push(`${done}/${total}`),
    });
    expect(seen).toEqual(['1/3', '2/3', '3/3']);
  });
});
