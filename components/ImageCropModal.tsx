'use client';

import { useEffect, useRef, useState } from 'react';
import { Crop, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

export interface CropResult {
  dataUrl: string;
  width: number;
  height: number;
}

interface ImageCropModalProps {
  file: File;
  onCancel: () => void;
  onConfirm: (result: CropResult) => void;
}

// Recuadro de recorte expresado en fracciones (0..1) de la imagen mostrada
interface CropBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

type DragMode = 'move' | 'nw' | 'ne' | 'sw' | 'se';

const MIN_SIZE = 0.05; // tamaño mínimo del recuadro (5% de la imagen)

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

export default function ImageCropModal({ file, onCancel, onConfirm }: ImageCropModalProps) {
  const [imageUrl, setImageUrl] = useState<string>('');
  const [box, setBox] = useState<CropBox>({ x: 0.05, y: 0.05, w: 0.9, h: 0.9 });
  const [isSaving, setIsSaving] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    mode: DragMode;
    startX: number;
    startY: number;
    startBox: CropBox;
    rectW: number;
    rectH: number;
  } | null>(null);

  // Crear / liberar la URL de objeto de la imagen
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Manejo del arrastre a nivel de ventana mientras hay una interacción activa
  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      const dx = (e.clientX - drag.startX) / drag.rectW;
      const dy = (e.clientY - drag.startY) / drag.rectH;
      const s = drag.startBox;

      setBox(() => {
        if (drag.mode === 'move') {
          return {
            ...s,
            x: clamp(s.x + dx, 0, 1 - s.w),
            y: clamp(s.y + dy, 0, 1 - s.h),
          };
        }

        let { x, y, w, h } = s;
        const right = s.x + s.w;
        const bottom = s.y + s.h;

        if (drag.mode === 'nw') {
          x = clamp(s.x + dx, 0, right - MIN_SIZE);
          y = clamp(s.y + dy, 0, bottom - MIN_SIZE);
          w = right - x;
          h = bottom - y;
        } else if (drag.mode === 'ne') {
          y = clamp(s.y + dy, 0, bottom - MIN_SIZE);
          w = clamp(s.w + dx, MIN_SIZE, 1 - s.x);
          h = bottom - y;
        } else if (drag.mode === 'sw') {
          x = clamp(s.x + dx, 0, right - MIN_SIZE);
          w = right - x;
          h = clamp(s.h + dy, MIN_SIZE, 1 - s.y);
        } else if (drag.mode === 'se') {
          w = clamp(s.w + dx, MIN_SIZE, 1 - s.x);
          h = clamp(s.h + dy, MIN_SIZE, 1 - s.y);
        }

        return { x, y, w, h };
      });
    };

    const handleUp = () => {
      dragRef.current = null;
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, []);

  const startDrag = (e: React.PointerEvent, mode: DragMode) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragRef.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      startBox: box,
      rectW: rect.width,
      rectH: rect.height,
    };
  };

  const handleConfirm = () => {
    setIsSaving(true);
    const img = new Image();
    img.onload = () => {
      const naturalW = img.naturalWidth;
      const naturalH = img.naturalHeight;

      const sx = Math.round(box.x * naturalW);
      const sy = Math.round(box.y * naturalH);
      const sw = Math.max(1, Math.round(box.w * naturalW));
      const sh = Math.max(1, Math.round(box.h * naturalH));

      const canvas = document.createElement('canvas');
      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setIsSaving(false);
        return;
      }
      // Fondo blanco por si la imagen tiene transparencia (PNG)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, sw, sh);
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      setIsSaving(false);
      onConfirm({ dataUrl, width: sw, height: sh });
    };
    img.onerror = () => setIsSaving(false);
    img.src = imageUrl;
  };

  const handleStyle = {
    left: `${box.x * 100}%`,
    top: `${box.y * 100}%`,
    width: `${box.w * 100}%`,
    height: `${box.h * 100}%`,
  };

  const corners: Array<{ mode: DragMode; className: string }> = [
    { mode: 'nw', className: '-left-1.5 -top-1.5 cursor-nwse-resize' },
    { mode: 'ne', className: '-right-1.5 -top-1.5 cursor-nesw-resize' },
    { mode: 'sw', className: '-left-1.5 -bottom-1.5 cursor-nesw-resize' },
    { mode: 'se', className: '-right-1.5 -bottom-1.5 cursor-nwse-resize' },
  ];

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Recortar imagen</DialogTitle>
          <DialogDescription>
            Arrastra el recuadro para marcar dónde empieza y termina el documento.
            Solo esa área se incluirá en el PDF.
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-center">
          <div
            ref={containerRef}
            className="relative inline-block max-h-[55dvh] select-none overflow-hidden sm:max-h-[60vh]"
            style={{ touchAction: 'none' }}
          >
            {imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt="Imagen a recortar"
                className="block max-h-[55dvh] w-auto pointer-events-none sm:max-h-[60vh]"
                draggable={false}
              />
            )}

            {/* Recuadro de recorte con oscurecimiento del exterior */}
            <div
              className="absolute border-2 border-white cursor-move"
              style={{
                ...handleStyle,
                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
              }}
              onPointerDown={(e) => startDrag(e, 'move')}
            >
              {corners.map((corner) => (
                <div
                  key={corner.mode}
                  onPointerDown={(e) => startDrag(e, corner.mode)}
                  // Visual compacto, pero el ::before extiende el área táctil
                  // ~10px por lado (objetivo cómodo con el dedo en móvil).
                  className={`absolute h-5 w-5 rounded-sm border-2 border-ink bg-white before:absolute before:-inset-2 before:content-[''] sm:h-3 sm:w-3 ${corner.className}`}
                />
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Recortando...
              </>
            ) : (
              <>
                <Crop className="w-4 h-4 mr-2" />
                Aplicar recorte
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
