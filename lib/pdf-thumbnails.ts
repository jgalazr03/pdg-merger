/**
 * Portadas y recuento de páginas con pdf.js, compartidos entre herramientas.
 *
 * pdf.js se carga de forma perezosa y una sola vez (worker en /public), para
 * que las herramientas abran al instante y solo paguen el coste al necesitar
 * una miniatura. El mismo cargador estaba repetido en varios componentes; este
 * es el sitio al que migrar.
 */

let pdfjsPromise: Promise<typeof import('pdfjs-dist')> | null = null;

export const loadPdfjs = async () => {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist').then((mod) => {
      mod.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
      return mod;
    });
  }
  return pdfjsPromise;
};

export interface PdfPreview {
  /** Número de páginas del documento. */
  pages: number;
  /** Primera página como data URL JPEG, o `null` si no se pudo dibujar. */
  thumbnail: string | null;
}

/**
 * Páginas + portada (primera página) de un PDF en una sola pasada. `width` es
 * el ancho en píxeles de la portada (usa el doble del tamaño en pantalla para
 * que se vea nítida en pantallas densas). Lanza si el PDF no se puede abrir
 * (cifrado o dañado): el llamador decide qué mostrar.
 */
export async function previewPdf(file: File, width = 160): Promise<PdfPreview> {
  const pdfjs = await loadPdfjs();
  const data = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data }).promise;
  try {
    const pages = pdf.numPages;
    let thumbnail: string | null = null;
    try {
      const page = await pdf.getPage(1);
      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(2, width / base.width);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(viewport.width));
      canvas.height = Math.max(1, Math.round(viewport.height));
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport }).promise;
        thumbnail = canvas.toDataURL('image/jpeg', 0.72);
      }
      page.cleanup();
    } catch {
      // Página ilegible: se conserva el recuento y la fila muestra el icono.
      thumbnail = null;
    }
    return { pages, thumbnail };
  } finally {
    await pdf.destroy();
  }
}

/**
 * Portada de una imagen: object URL del propio archivo (sin decodificar nada
 * más). Hay que liberarla con `revokeImagePreview` cuando la fila desaparece.
 */
export const imagePreviewUrl = (file: File): string => URL.createObjectURL(file);

export const revokeImagePreview = (url: string) => {
  if (url.startsWith('blob:')) URL.revokeObjectURL(url);
};
