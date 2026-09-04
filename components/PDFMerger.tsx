'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { PDFDocument } from 'pdf-lib';
import {
  FileText,
  Download,
  Loader2,
  X,
  GripVertical,
  ArrowDownAZ,
  Image as ImageIcon,
  Crop,
  ChevronUp,
  ChevronDown,
  Images,
  ImageOff,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { toastUndo } from '@/lib/toast';
import { useHandoff, fileListFrom } from '@/lib/handoff';
import { getTool } from '@/lib/tools';
import { fileNameError, resolveFileName } from '@/lib/file-name';
import {
  previewPdf,
  imagePreviewUrl,
  revokeImagePreview,
} from '@/lib/pdf-thumbnails';
import ToolShell from '@/components/tools/ToolShell';
import { useScrollOnAppear } from '@/components/tools/useScrollOnAppear';
import FileDropzone from '@/components/tools/FileDropzone';
import ToolConstraints from '@/components/tools/ToolConstraints';
import NextSteps from '@/components/tools/NextSteps';
import FileNameField from '@/components/tools/FileNameField';
import { useFlip } from '@/components/tools/useFlip';
import ImageCropModal, { CropResult } from '@/components/ImageCropModal';

const tool = getTool('unir');
const accent = tool.accent;

interface PDFFile {
  id: string;
  file: File;
  name: string;
  size: string;
  type: 'pdf' | 'image';
  cropped?: CropResult;
  /** Páginas del archivo: `undefined` mientras se cuenta, `null` si no se pudo. */
  pages?: number | null;
  /** Portada: data URL (PDF, primera página) u object URL (imagen);
   *  `undefined` mientras se genera, `null` si no se pudo. */
  thumb?: string | null;
  /** Mensaje si el archivo no se pudo abrir (contraseña o dañado). Sin
   *  error, no cuenta para el resumen ni participa en la unión. */
  error?: string;
}

/** Mensajes de error por archivo, compartidos entre `hydratePreviews` y
 *  `mergePDFs` (el mismo archivo puede fallar en cualquiera de los dos). */
const PASSWORD_ERROR = 'Protegido con contraseña. Quítala primero con Proteger PDF.';
const GENERIC_FILE_ERROR = 'No se pudo abrir este archivo. Comprueba que no esté dañado.';

/** Traduce el error de pdf.js / pdf-lib al mensaje que ve la persona usuaria. */
const messageForFileError = (err: unknown): string =>
  (err as { name?: string } | null)?.name === 'PasswordException'
    ? PASSWORD_ERROR
    : GENERIC_FILE_ERROR;

/** Preferencia "mostrar portadas" (localStorage; por defecto, sí). */
const COVERS_KEY = 'gainco:unir:portadas';

interface MergeResult {
  url: string;
  size: number;
  pages: number;
  /** El blob detrás de `url`: se conserva para poder traspasarlo ("Continuar
   *  con…") como un `File` nuevo sin volver a generar el PDF. */
  blob: Blob;
}

interface MergeProgress {
  done: number;
  total: number;
  label: string;
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/** Deja pintar a React antes de un tramo de trabajo síncrono pesado. */
const yieldToPaint = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => setTimeout(resolve, 0));
  });

export default function PDFMerger() {
  const [files, setFiles] = useState<PDFFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<MergeProgress | null>(null);
  const [result, setResult] = useState<MergeResult | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const [fileName, setFileName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [cropFileId, setCropFileId] = useState<string | null>(null);

  // El PDF generado es una foto de la lista en el momento de unir. Si la lista
  // cambia después (agregar, quitar, reordenar, recortar), ese resultado ya no
  // corresponde: se descarta para que vuelva "Unir archivos" y se regenere.
  // Se detecta por firma (no por cada mutador) para no olvidar ninguno.
  const filesSignature = files
    .map((f) =>
      f.cropped
        ? `${f.id}:${f.cropped.width}x${f.cropped.height}:${f.cropped.dataUrl.length}`
        : f.id
    )
    .join('|');
  // Último resultado visto (no en las dependencias del efecto: si lo
  // metiéramos, el propio setResult(null) volvería a dispararlo). Así el
  // aviso de abajo solo suena cuando SÍ había un PDF generado.
  const lastResultRef = useRef<MergeResult | null>(null);
  useEffect(() => {
    lastResultRef.current = result;
  }, [result]);

  useEffect(() => {
    if (lastResultRef.current) {
      toast('La lista cambió', {
        description: 'Vuelve a pulsar "Unir archivos" para actualizar el PDF.',
      });
    }
    setResult(null);
  }, [filesSignature]);
  // Última firma vista: la unión es asíncrona y la lista puede cambiar mientras
  // corre; al terminar se compara para no publicar un PDF que ya nació viejo.
  const filesSignatureRef = useRef(filesSignature);
  useEffect(() => {
    filesSignatureRef.current = filesSignature;
  }, [filesSignature]);

  // Libera el object URL del resultado al descartarlo, regenerar o desmontar.
  useEffect(() => {
    return () => {
      if (result) URL.revokeObjectURL(result.url);
    };
  }, [result]);

  const handleFileNameChange = (value: string) => {
    setFileName(value);
    setNameError(fileNameError(value));
  };

  const isPdfFile = (file: File): boolean =>
    file.type === 'application/pdf' || /\.pdf$/i.test(file.name);

  const isImageFile = (file: File): boolean =>
    file.type === 'image/jpeg' ||
    file.type === 'image/png' ||
    /\.(jpe?g|png)$/i.test(file.name);

  // Portada y páginas de los PDFs recién agregados, uno a uno (pdf.js en su
  // worker) para no abrir varios a la vez. Si el archivo se quitó mientras
  // tanto, el map no hace nada.
  const hydratePreviews = async (added: PDFFile[]) => {
    for (const f of added) {
      if (f.type !== 'pdf') continue;
      let pages: number | null = null;
      let thumb: string | null = null;
      let error: string | undefined;
      try {
        const preview = await previewPdf(f.file, 120);
        pages = preview.pages;
        thumb = preview.thumbnail;
      } catch (err) {
        // Cifrado o ilegible: se marca la fila; el resumen y "unir" lo excluyen.
        error = messageForFileError(err);
      }
      setFiles((prev) =>
        prev.map((x) => (x.id === f.id ? { ...x, pages, thumb, error } : x))
      );
    }
  };

  // Las portadas de imagen son object URLs: se liberan al quitar la fila, al
  // empezar de nuevo y al desmontar (no al "Limpiar todo", que tiene deshacer).
  const filesRef = useRef(files);
  useEffect(() => {
    filesRef.current = files;
  }, [files]);
  useEffect(() => {
    return () => {
      filesRef.current.forEach((f) => {
        if (f.type === 'image' && f.thumb) revokeImagePreview(f.thumb);
      });
    };
  }, []);

  const [showCovers, setShowCovers] = useState(true);
  useEffect(() => {
    try {
      if (window.localStorage.getItem(COVERS_KEY) === '0') setShowCovers(false);
    } catch {
      // Sin almacenamiento: se queda el valor por defecto.
    }
  }, []);
  const toggleCovers = () => {
    const next = !showCovers;
    setShowCovers(next);
    try {
      window.localStorage.setItem(COVERS_KEY, next ? '1' : '0');
    } catch {
      // Sin almacenamiento: la preferencia dura la sesión.
    }
  };

  const handleFileSelect = (selectedFiles: FileList) => {
    const incoming = Array.from(selectedFiles);
    const rejected = incoming.filter(
      (file) => !isPdfFile(file) && !isImageFile(file)
    );
    const newFiles: PDFFile[] = incoming
      .filter((file) => isPdfFile(file) || isImageFile(file))
      .map((file) => {
        const type = isPdfFile(file) ? ('pdf' as const) : ('image' as const);
        return {
          id: Math.random().toString(36).substring(2, 15),
          file,
          name: file.name.replace(/\.(pdf|jpe?g|png)$/i, ''),
          size: formatFileSize(file.size),
          type,
          // Una imagen siempre es una página y su portada es ella misma; los
          // PDFs se cuentan y se dibujan aparte (hydratePreviews).
          pages: type === 'image' ? 1 : undefined,
          thumb: type === 'image' ? imagePreviewUrl(file) : undefined,
        };
      });

    if (rejected.length > 0) {
      toast.error('Algunos archivos no son válidos', {
        description: 'Solo se aceptan archivos PDF e imágenes JPG o PNG.',
      });
    }

    if (newFiles.length > 0) {
      setFiles((prev) => [...prev, ...newFiles]);
      toast.success(
        `${newFiles.length} archivo${newFiles.length !== 1 ? 's' : ''} agregado${newFiles.length !== 1 ? 's' : ''}`
      );
      void hydratePreviews(newFiles);
    }
  };

  // Recibe el archivo traspasado desde otra herramienta ("Continuar con…"),
  // p. ej. un PDF recién comprimido, y lo agrega como si se hubiera elegido.
  useHandoff((file) => {
    handleFileSelect(fileListFrom([file]));
  });

  // Eliminar con SALIDA: la fila se desvanece (opacidad + escala, GPU) y al
  // terminar se quita del estado; entonces el FLIP cierra el hueco deslizando
  // las demás. Así la lista se siente "viva" igual que al reordenar.
  const removeFile = (id: string) => {
    const index = files.findIndex((file) => file.id === id);
    if (index === -1) return;
    const gone = files[index];
    setRemovingIds((prev) => new Set(prev).add(id));
    window.setTimeout(() => {
      if (gone.type === 'image' && gone.thumb) revokeImagePreview(gone.thumb);
      setFiles((prev) => prev.filter((file) => file.id !== id));
      setRemovingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      toastUndo('Archivo quitado', {
        description: gone.name,
        onUndo: () => {
          // La portada de imagen (object URL) ya se liberó al quitar: se
          // regenera para poder mostrarla de nuevo.
          const restored: PDFFile =
            gone.type === 'image'
              ? { ...gone, thumb: imagePreviewUrl(gone.file) }
              : gone;
          setFiles((prev) => {
            const next = [...prev];
            next.splice(Math.min(index, next.length), 0, restored);
            return next;
          });
        },
      });
    }, 160);
  };

  // Convierte un data URL (base64) en bytes para embeber en el PDF
  const dataUrlToBytes = (dataUrl: string): Uint8Array => {
    const base64 = dataUrl.split(',')[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  };

  const handleCropConfirm = (crop: CropResult) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === cropFileId ? { ...f, cropped: crop } : f))
    );
    setCropFileId(null);
  };

  const fileToCrop = files.find((f) => f.id === cropFileId);

  // FLIP: desliza las filas a su nueva posición al reordenar (arrastre o flechas).
  const listRef = useFlip<HTMLUListElement>(files.map((f) => f.id).join('|'));

  // Reordenamiento por arrastre. Marcamos el DESTINO mientras se arrastra y
  // reordenamos AL SOLTAR; el FLIP (useFlip) desliza las filas a su nuevo sitio.
  // No reordenamos en vivo a propósito: con arrastre nativo eso entra en bucle
  // (las filas se deslizan bajo el cursor y vuelven a disparar dragover).
  const endDrag = () => {
    setDraggedIndex(null);
    setOverIndex(null);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    if (isProcessing) {
      e.preventDefault();
      return;
    }
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (overIndex !== index) setOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex !== null) moveFile(draggedIndex, dropIndex);
    endDrag();
  };

  // Reordenamiento accesible por teclado
  const moveFile = (from: number, to: number) => {
    if (isProcessing) return;
    if (to < 0 || to >= files.length || from === to) return;
    const newFiles = [...files];
    const [moved] = newFiles.splice(from, 1);
    newFiles.splice(to, 0, moved);
    setFiles(newFiles);
  };

  // Orden alfabético por nombre (numérico: "hoja2" antes que "hoja10"). El
  // FLIP existente anima el movimiento; si el orden no cambia, no hace nada.
  const sortFilesAZ = () => {
    const previous = files;
    const sorted = [...files].sort((a, b) =>
      a.name.localeCompare(b.name, 'es', { numeric: true, sensitivity: 'base' })
    );
    const changed = sorted.some((f, i) => f.id !== previous[i].id);
    if (!changed) return;
    setFiles(sorted);
    toastUndo('Lista ordenada', {
      description: 'De la A a la Z por nombre.',
      onUndo: () => setFiles(previous),
    });
  };

  const mergePDFs = async () => {
    if (files.length < 1) return;
    if (nameError) return;

    const signatureAtStart = filesSignature;
    const total = files.length;
    setIsProcessing(true);
    // Fallos nuevos, detectados solo al unir (no en hydratePreviews): se
    // aplican al estado al final, junto con el resto del resultado.
    const newFailures: { id: string; error: string }[] = [];
    let mergedCount = 0;
    try {
      const mergedPdf = await PDFDocument.create();

      // Dimensiones de una página tamaño Carta (Letter) en puntos
      const LETTER_SHORT = 612;
      const LETTER_LONG = 792;

      for (let i = 0; i < files.length; i++) {
        const pdfFile = files[i];
        // Progreso por archivo: el trabajo pesado de pdf-lib es síncrono, así
        // que se cede un frame para que el texto y la barra lleguen a pintarse.
        setProgress({ done: i, total, label: `Uniendo ${i + 1} de ${total}…` });
        await yieldToPaint();

        if (pdfFile.error) continue; // ya marcado (contraseña o dañado): se salta

        try {
          if (pdfFile.type === 'image' && pdfFile.cropped) {
            // Imagen recortada: se coloca centrada en una hoja Carta auto-orientada
            const bytes = dataUrlToBytes(pdfFile.cropped.dataUrl);
            const image = await mergedPdf.embedJpg(bytes);

            // Orientar la hoja Carta según la proporción de la imagen recortada
            const landscape = pdfFile.cropped.width > pdfFile.cropped.height;
            const pageWidth = landscape ? LETTER_LONG : LETTER_SHORT;
            const pageHeight = landscape ? LETTER_SHORT : LETTER_LONG;

            const page = mergedPdf.addPage([pageWidth, pageHeight]);
            const scaled = image.scaleToFit(pageWidth, pageHeight);
            page.drawImage(image, {
              x: (pageWidth - scaled.width) / 2,
              y: (pageHeight - scaled.height) / 2,
              width: scaled.width,
              height: scaled.height,
            });
          } else if (pdfFile.type === 'image') {
            // Imagen sin recortar: página del tamaño exacto de la imagen (sin bordes)
            const arrayBuffer = await pdfFile.file.arrayBuffer();
            const isPng =
              pdfFile.file.type === 'image/png' || /\.png$/i.test(pdfFile.file.name);
            const image = isPng
              ? await mergedPdf.embedPng(arrayBuffer)
              : await mergedPdf.embedJpg(arrayBuffer);

            const page = mergedPdf.addPage([image.width, image.height]);
            page.drawImage(image, {
              x: 0,
              y: 0,
              width: image.width,
              height: image.height,
            });
          } else {
            const arrayBuffer = await pdfFile.file.arrayBuffer();
            const pdf = await PDFDocument.load(arrayBuffer);
            const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
            copiedPages.forEach((page) => mergedPdf.addPage(page));
          }
          mergedCount++;
        } catch (err) {
          // Este archivo falla solo al unir (pasó hydratePreviews pero pdf-lib
          // lo rechaza): se marca y se sigue con el resto del lote.
          console.error('Error al procesar', pdfFile.name, err);
          newFailures.push({ id: pdfFile.id, error: messageForFileError(err) });
        }
      }

      if (newFailures.length > 0) {
        setFiles((prev) =>
          prev.map((f) => {
            const failed = newFailures.find((x) => x.id === f.id);
            return failed ? { ...f, error: failed.error, pages: null, thumb: null } : f;
          })
        );
      }

      if (mergedCount === 0) {
        toast.error('No se pudo generar el PDF', {
          description: 'Revisa los archivos e inténtalo de nuevo.',
        });
        return;
      }

      setProgress({ done: total, total, label: 'Guardando el PDF…' });
      await yieldToPaint();
      const pdfBytes = await mergedPdf.save();
      if (filesSignatureRef.current !== signatureAtStart) {
        // Se agregó, quitó o reordenó algo durante la unión: este PDF no
        // refleja la lista actual. Se descarta y se pide volver a unir.
        toast('La lista cambió mientras se unía', {
          description: 'Vuelve a pulsar "Unir archivos" para generar el PDF con la lista actual.',
        });
        return;
      }
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      setResult({
        url: URL.createObjectURL(blob),
        size: blob.size,
        pages: mergedPdf.getPageCount(),
        blob,
      });
      // Aviso si quedó alguno fuera, tanto si falló ahora como si ya venía
      // marcado al agregarlo: el resultado no es "todo lo que subiste".
      if (mergedCount < total) {
        toast(`Se unieron ${mergedCount} de ${total} archivos`, {
          description: 'Revisa los marcados en rojo.',
        });
      } else {
        toast.success('¡PDF generado correctamente!');
      }
    } catch (error) {
      console.error('Error merging PDFs:', error);
      toast.error('No se pudo generar el PDF', {
        description: 'Revisa los archivos e inténtalo de nuevo.',
      });
    } finally {
      setIsProcessing(false);
      setProgress(null);
    }
  };

  const downloadMergedPDF = () => {
    if (!result) return;

    const finalFileName = `${resolveFileName(fileName, 'documento_final')}.pdf`;
    const link = document.createElement('a');
    link.href = result.url;
    link.download = finalFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Archivo del resultado para el traspaso "Continuar con…": se reconstruye
  // del blob guardado (no vuelve a generar el PDF).
  const resultFile = (): File | null =>
    result
      ? new File([result.blob], `${resolveFileName(fileName, 'documento_final')}.pdf`, {
          type: 'application/pdf',
        })
      : null;

  const resetAll = () => {
    setFiles([]);
    setResult(null);
    setProgress(null);
    setFileName('');
    setNameError(null);
  };

  // "Crear otro PDF": sin deshacer, así que las portadas de imagen se liberan.
  const startOver = () => {
    files.forEach((f) => {
      if (f.type === 'image' && f.thumb) revokeImagePreview(f.thumb);
    });
    resetAll();
  };

  // Acción destructiva con red de seguridad: vacía la lista pero ofrece deshacer.
  // Se restauran archivos y nombre, no el PDF generado: su URL ya se liberó y
  // el usuario vuelve a "Unir archivos" con la lista recuperada.
  const clearAll = () => {
    if (files.length === 0 || isProcessing) return;
    const snapshot = { files, fileName };
    const count = files.length;
    resetAll();
    toastUndo('Lista vaciada', {
      description: `Se ${count === 1 ? 'quitó' : 'quitaron'} ${count} archivo${count !== 1 ? 's' : ''}.`,
      onUndo: () => {
        setFiles(snapshot.files);
        setFileName(snapshot.fileName);
      },
    });
  };

  // En móvil, bajar a la lista cuando aparece: el botón vive en la barra
  // inferior fija y, sin esto, la lista queda tapada por ella.
  const listCardRef = useRef<HTMLDivElement>(null);
  useScrollOnAppear(listCardRef, files.length > 0);

  const step: 1 | 2 | 3 = files.length === 0 ? 1 : result ? 3 : 2;

  // ---- Resumen para el panel de acción -------------------------------------
  // Los archivos con error no cuentan para páginas ni peso, y no participan
  // en la unión: el resumen los señala aparte ("N archivos (M con error)").
  const validFiles = files.filter((f) => !f.error);
  const errorCount = files.length - validFiles.length;
  const totalBytes = validFiles.reduce((sum, f) => sum + f.file.size, 0);
  const pagesPending = validFiles.some((f) => f.pages === undefined);
  const pagesUnknown = validFiles.some((f) => f.pages === null);
  const pagesKnown = validFiles.reduce((sum, f) => sum + (f.pages ?? 0), 0);
  const pagesLabel = pagesPending
    ? 'contando páginas…'
    : `${pagesUnknown ? 'al menos ' : ''}${pagesKnown} ${pagesKnown === 1 ? 'página' : 'páginas'}`;
  const filesLabel =
    errorCount > 0
      ? `${files.length} ${files.length === 1 ? 'archivo' : 'archivos'} (${errorCount} con error)`
      : `${files.length} ${files.length === 1 ? 'archivo' : 'archivos'}`;
  const ctaLabel = isProcessing
    ? 'Procesando…'
    : files.length > 1
      ? 'Unir archivos'
      : 'Generar PDF';
  // Si hay archivos y ninguno es válido, no hay nada que unir.
  const noValidFiles = files.length > 0 && validFiles.length === 0;
  const ctaDisabled = isProcessing || !!nameError || noValidFiles;
  const resultName = `${resolveFileName(fileName, 'documento_final')}.pdf`;

  const progressBlock = progress && (
    <div className="mt-3" aria-live="polite">
      <p className="text-sm font-bold tabular-nums text-ink">{progress.label}</p>
      <Progress
        value={(progress.done / progress.total) * 100}
        className="mt-2 h-2"
        aria-label="Progreso de la unión"
      />
    </div>
  );

  // Panel de acción (lg+: columna derecha pegajosa; debajo: fluye tras la lista
  // y deja el resumen y el botón a la barra inferior).
  const aside = files.length > 0 && (
    <div className="rounded-lg border-3 border-ink bg-card p-4 sm:p-5">
      {result ? (
        <>
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-success">
            Listo
          </p>
          <p className="mt-2 break-words text-base font-bold text-ink">{resultName}</p>
          <p className="mt-1 text-sm tabular-nums text-muted-foreground">
            {result.pages} {result.pages === 1 ? 'página' : 'páginas'} ·{' '}
            {formatFileSize(result.size)}
          </p>
          <div className="mt-4 hidden flex-col gap-2 lg:flex">
            <Button
              onClick={downloadMergedPDF}
              size="lg"
              className={cn('w-full', accent.solid)}
            >
              <Download className="mr-2 h-5 w-5" />
              Descargar PDF
            </Button>
            <Button variant="outline" onClick={startOver} size="lg" className="w-full">
              Crear otro PDF
            </Button>
          </div>
          <NextSteps
            tool={tool}
            getFile={resultFile}
            className="mt-4 border-t-3 border-ink pt-4"
          />
        </>
      ) : (
        <>
          <div className="hidden lg:block">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">
              Resumen
            </p>
            <p className="mt-2 text-sm font-bold tabular-nums text-ink" aria-live="polite">
              {filesLabel} · {formatFileSize(totalBytes)}
            </p>
            <p className="text-sm tabular-nums text-muted-foreground">{pagesLabel}</p>
          </div>

          <div className="lg:mt-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground lg:hidden">
              Opciones
            </p>
            <FileNameField
              id="filename"
              label="Nombre del archivo final"
              value={fileName}
              onChange={handleFileNameChange}
              error={nameError}
              placeholder="documento_final"
              extension=".pdf"
              disabled={isProcessing}
              onSubmit={() => {
                if (!ctaDisabled) void mergePDFs();
              }}
            />
          </div>

          <div className="mt-4 hidden lg:block">
            <Button
              onClick={mergePDFs}
              disabled={ctaDisabled}
              aria-busy={isProcessing}
              size="lg"
              className={cn('w-full', accent.solid)}
            >
              {isProcessing ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <FileText className="mr-2 h-5 w-5" />
              )}
              {ctaLabel}
            </Button>
            {progressBlock}
          </div>
        </>
      )}
    </div>
  );

  // Barra inferior fija (solo por debajo de lg): resumen compacto + acción.
  const bar = files.length > 0 && (
    <div className="border-t-3 border-ink bg-surface pl-[max(20px,env(safe-area-inset-left))] pr-[max(20px,env(safe-area-inset-right))] pb-[max(12px,env(safe-area-inset-bottom))] pt-3">
      <div className="container mx-auto flex max-w-6xl items-center gap-3">
        <div className="min-w-0 flex-1">
          {result ? (
            <>
              <p className="truncate text-sm font-bold text-ink">{resultName}</p>
              <p className="truncate text-xs tabular-nums text-muted-foreground">
                {result.pages} {result.pages === 1 ? 'página' : 'páginas'} ·{' '}
                {formatFileSize(result.size)}
              </p>
            </>
          ) : progress ? (
            <div aria-live="polite">
              <p className="truncate text-sm font-bold tabular-nums text-ink">
                {progress.label}
              </p>
              <Progress
                value={(progress.done / progress.total) * 100}
                className="mt-1.5 h-2"
                aria-label="Progreso de la unión"
              />
            </div>
          ) : (
            <>
              <p className="truncate text-sm font-bold tabular-nums text-ink">
                {filesLabel}
              </p>
              <p className="truncate text-xs tabular-nums text-muted-foreground">
                {formatFileSize(totalBytes)} · {pagesLabel}
              </p>
            </>
          )}
        </div>
        {result ? (
          <>
            <Button variant="outline" onClick={startOver} className="shrink-0">
              Otro
            </Button>
            <Button onClick={downloadMergedPDF} className={cn('shrink-0', accent.solid)}>
              <Download className="mr-2 h-4 w-4" />
              Descargar
            </Button>
          </>
        ) : (
          <Button
            onClick={mergePDFs}
            disabled={ctaDisabled}
            aria-busy={isProcessing}
            className={cn('shrink-0', accent.solid)}
          >
            {isProcessing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileText className="mr-2 h-4 w-4" />
            )}
            {ctaLabel}
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <ToolShell tool={tool} step={step} aside={aside} bar={bar}>
      <FileDropzone
        className="mb-4"
        accent={accent}
        loaded={step > 1}
        multiple
        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
        idleTitle="Selecciona archivos PDF o imágenes"
        idleSubtitle="Haz clic aquí o arrastra y suelta tus archivos PDF o imágenes (JPG, PNG)"
        dragTitle="Suelta los archivos aquí"
        buttonLabel="Seleccionar archivos"
        ariaLabel="Seleccionar o arrastrar archivos PDF o imágenes"
        onFiles={handleFileSelect}
      />

      <ToolConstraints items={tool.constraints} />

      {files.length > 0 && (
        <Card ref={listCardRef} className="motion-safe:animate-slide-up">
          <CardContent className="p-4 sm:p-6">
            {/* Encabezado + acción: apilados en móvil (el título mono envuelve
                y chocaba con el botón); en una fila a partir de sm. */}
            {/* Con tres acciones, el título no se estruja: si no caben en la
                fila, las acciones bajan a su propia línea, alineadas a la derecha. */}
            <div className="mb-6 flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <h2 className="whitespace-nowrap font-display text-lg font-bold text-ink">
                Archivos seleccionados ({files.length})
              </h2>
              <div className="flex shrink-0 flex-wrap items-center gap-2 sm:ml-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={sortFilesAZ}
                  disabled={isProcessing || files.length < 2}
                  className="shrink-0"
                >
                  <ArrowDownAZ className="mr-2 h-4 w-4" />
                  Ordenar A→Z
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleCovers}
                  aria-pressed={showCovers}
                  title={showCovers ? 'Ocultar portadas' : 'Mostrar portadas'}
                  className="shrink-0"
                >
                  {showCovers ? (
                    <Images className="mr-2 h-4 w-4" />
                  ) : (
                    <ImageOff className="mr-2 h-4 w-4" />
                  )}
                  Portadas
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearAll}
                  disabled={isProcessing}
                  className="shrink-0"
                >
                  <X className="mr-2 h-4 w-4" />
                  Limpiar todo
                </Button>
              </div>
            </div>

            <ul ref={listRef} className="space-y-3">
              {files.map((file, index) => (
                <li
                  key={file.id}
                  data-flip-id={file.id}
                  draggable={!isProcessing}
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={endDrag}
                  className={cn(
                    // flex-wrap: en móvil las acciones de imagen (recortar/quitar)
                    // bajan a una segunda línea con sitio, en vez de desbordar.
                    'flex flex-wrap items-center gap-2.5 rounded-lg border-3 border-ink bg-surface p-3 transition-[opacity,box-shadow,background-color,transform] duration-150 ease-out hover-fine:bg-muted active:bg-muted sm:gap-3 sm:p-4',
                    // La fila tomada se atenúa (el "fantasma" nativo sigue al cursor);
                    // NO le ponemos transform aquí para no chocar con el FLIP.
                    draggedIndex === index && 'opacity-50',
                    // Salida al eliminar: se desvanece y encoge antes de quitarse.
                    removingIds.has(file.id) &&
                      'pointer-events-none opacity-0 motion-safe:scale-[0.97]',
                    // Destino del soltado: anillo navy (igual que PDFOrganizer).
                    overIndex === index &&
                      draggedIndex !== null &&
                      draggedIndex !== index &&
                      'ring-2 ring-ink ring-offset-2'
                  )}
                >
                  <GripVertical
                    className="hidden h-5 w-5 shrink-0 cursor-move text-muted-foreground sm:block"
                    aria-hidden="true"
                  />

                  {/* Controles de orden accesibles por teclado */}
                  <div className="flex shrink-0 flex-row sm:flex-col">
                    <button
                      type="button"
                      onClick={() => moveFile(index, index - 1)}
                      disabled={index === 0 || isProcessing}
                      aria-label={`Mover ${file.name} hacia arriba`}
                      className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover-fine:bg-muted hover-fine:text-ink active:bg-muted disabled:opacity-30 disabled:hover-fine:bg-transparent disabled:hover-fine:text-muted-foreground disabled:active:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
                        accent.ring
                      )}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveFile(index, index + 1)}
                      disabled={index === files.length - 1 || isProcessing}
                      aria-label={`Mover ${file.name} hacia abajo`}
                      className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover-fine:bg-muted hover-fine:text-ink active:bg-muted disabled:opacity-30 disabled:hover-fine:bg-transparent disabled:hover-fine:text-muted-foreground disabled:active:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
                        accent.ring
                      )}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Móvil: portada + nombre ocupan su propia línea (order-first,
                      basis-full); desde sm comparten fila con flechas y acciones. */}
                  <div className="order-first flex min-w-0 grow basis-full items-center gap-3 sm:order-none sm:basis-0">
                    {/* Portada (primera página o la imagen, recortada si lo
                        está): se reconoce el documento sin leer el nombre.
                        draggable=false para que arrastre la fila, no la imagen. */}
                    <div className="flex h-12 w-9 shrink-0 items-center justify-center overflow-hidden rounded border-2 border-ink bg-white sm:h-14 sm:w-11">
                      {showCovers && (file.cropped?.dataUrl ?? file.thumb) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={file.cropped?.dataUrl ?? file.thumb ?? undefined}
                          alt=""
                          draggable={false}
                          className="h-full w-full object-contain"
                        />
                      ) : file.type === 'image' ? (
                        <ImageIcon className="h-5 w-5 text-ink" />
                      ) : (
                        <FileText className="h-5 w-5 text-ink" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      {/* Móvil: hasta dos líneas (la fila es estrecha y "contr…"
                          no dice nada); desde sm, una línea con elipsis. */}
                      <p className="line-clamp-2 break-words font-medium text-ink sm:line-clamp-1">
                        {file.name}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm tabular-nums text-muted-foreground">
                        <span className="whitespace-nowrap">{file.size}</span>
                        {typeof file.pages === 'number' && (
                          <span className="whitespace-nowrap">
                            · {file.pages} {file.pages === 1 ? 'página' : 'páginas'}
                          </span>
                        )}
                        {file.cropped && (
                          <span className="inline-flex items-center gap-1 whitespace-nowrap font-medium text-success">
                            <Crop className="h-3 w-3" />
                            Recortado
                          </span>
                        )}
                      </div>
                      {file.error && (
                        <p className="text-sm text-brand-red">
                          {file.error}
                          {file.error === PASSWORD_ERROR && (
                            <Link
                              href="/contrasena-pdf"
                              className="ml-2 font-bold text-ink underline underline-offset-4"
                            >
                              Abrir Proteger PDF
                            </Link>
                          )}
                        </p>
                      )}
                    </div>
                    <span className="hidden shrink-0 text-sm text-muted-foreground sm:inline">
                      #{index + 1}
                    </span>
                  </div>

                  {/* Acciones: para imágenes (Recortar + X) ocupan su propia
                      línea (w-full) hasta xl, donde la columna de contenido ya
                      da sitio al nombre; así el nombre no se trunca. Para PDFs
                      la X cabe siempre inline. */}
                  <div
                    className={cn(
                      'ml-auto flex items-center justify-end gap-2 sm:ml-0',
                      file.type === 'image' ? 'w-auto sm:w-full xl:w-auto' : 'w-auto'
                    )}
                  >
                    {file.type === 'image' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCropFileId(file.id)}
                        disabled={isProcessing}
                        className="shrink-0"
                        title="Recortar imagen"
                      >
                        <Crop className="mr-2 h-4 w-4" />
                        {file.cropped ? 'Reajustar' : 'Recortar'}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(file.id)}
                      disabled={isProcessing}
                      aria-label={`Quitar ${file.name}`}
                      className="shrink-0 text-muted-foreground hover-fine:text-ink"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>

            <div className={cn('mt-6 rounded-lg border-3 border-ink p-4', accent.soft)}>
              <p className={cn('text-sm', accent.softText)}>
                <strong>Tip:</strong> arrastra los archivos (o usa las flechas) para
                cambiar el orden. Se unirán en el orden que aparecen aquí. Usa el
                ícono de recorte en las imágenes para ajustarlas a tamaño Carta.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {fileToCrop && (
        <ImageCropModal
          file={fileToCrop.file}
          onCancel={() => setCropFileId(null)}
          onConfirm={handleCropConfirm}
        />
      )}
    </ToolShell>
  );
}
