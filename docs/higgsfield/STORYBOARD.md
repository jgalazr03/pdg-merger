# Storyboard — Experiencia Higgsfield (modo: ambiental coherente)

Pipeline: **keyframe (Recraft 4.1, vector + paleta bloqueada) → animar (Kling 3.0,
start=end frame para loop) → integrar en Next**.
Los assets de Higgsfield son archivos (SVG/MP4/WebM) que incrustamos; Higgsfield
NO es la UI en runtime. La experiencia **envuelve, no bloquea**: respeta el valor
de la app ("resueltos al instante" + privacidad client-side).
Detalle técnico del pipeline (modelos, costos, trucos): ver memoria
`higgsfield-experience-pipeline`.

---

## Dirección de arte (la regla, para TODOS los prompts)

Anclada a los tokens reales del sistema neo-brutalista:

| Rol            | Hex        | Uso en los assets                              |
| -------------- | ---------- | ---------------------------------------------- |
| Papel / fondo  | `#fcfaf7`  | fondo cálido casi blanco, SIEMPRE              |
| Navy / ink     | `#000044`  | líneas, bordes gruesos, "texto" sugerido       |
| Teal           | `#0d9488`  | un solo acento de línea, mínimo                 |
| Arena / panel  | `#f3ead9`  | superficies/tarjetas si hace falta volumen      |
| Rojo señal     | `#c60014`  | PROHIBIDO en ambiente (solo = error en la app) |

Principios no negociables (van como estilo en cada prompt):
- **Bicromo papel+navy.** Casi monocromo. Teal solo como un toque.
- **Tinta sobre papel / risograph / editorial plano.** Nada de realismo 3D,
  nada de gradientes lujosos, nada de lens flare, nada de bokeh cinematográfico.
- **Geometría rígida, bordes gruesos** (3–4px equivalente). Es la firma.
- **Movimiento contenido y mecánico.** Loops cortos, cámara casi fija, sin
  easing dramático. La emoción está en la *resolución* (caos→orden), no en la
  cámara.
- Texto = **sugerido** con rayas/barras navy, nunca letras reales (evita gibberish).

Cola anti-deriva para pegar al final de cada prompt de Soul:
> flat editorial risograph illustration, two-tone warm paper #fcfaf7 and deep
> navy ink #000044, single teal #0d9488 line accent, thick clean outlines, no
> gradients, no lens flare, no 3D realism, no photographic depth of field,
> minimal, restrained, high contrast print aesthetic.

---

## El "story": Caos → Orden

La narrativa ya vive en la app: páginas dispersas que se **resuelven** en un
documento limpio, al instante. Todos los beats son variaciones de eso.

---

## Beats (Fase 1 = los 3 primeros)

### Beat 1 — HERO · "El documento que se resuelve" ✅ HECHO
- **Estado:** integrado en `app/page.tsx` (columna derecha del hero). Assets en
  `public/higgsfield/hero/` (`hero.mp4` + `hero.webm` + `hero.svg` póster).
  Keyframe elegido: variante 1 de `docs/higgsfield/keyframes/hero-v1/`.
- **Dónde:** junto/detrás del H1 del landing (`app/page.tsx`). Loop sutil.
- **Aspect:** 16:9 (probar 21:9 si va como banda).
- **Keyframe (Soul):**
  > Top-down view of several loose paper sheets, slightly rotated and scattered
  > on a warm paper surface, converging and stacking into one clean bound
  > document with a thick navy outline; text on the pages suggested only as navy
  > horizontal bars; a single teal line marks the binding seam. [+ cola anti-deriva]
- **Animación (image-to-video):** las hojas se deslizan y se apilan en su sitio,
  ensamblaje mecánico de ~2–3s; cámara fija top-down. Loop seamless.

### Beat 2 — PROCESANDO · "Tinta que alinea"
- **Dónde:** overlay/inline mientras una herramienta procesa (OCR, unir, comprimir).
- **Aspect:** 1:1 (loop perfecto).
- **Keyframe (Soul):**
  > A column of short navy ink bars on warm paper, progressively aligning into a
  > neat justified block, a thin teal progress line sweeping down; flat minimal,
  > thick framing border. [+ cola anti-deriva]
- **Animación:** barrido teal de arriba a abajo + barras que se alinean; bucle
  perfecto sin "salto". Corto (~1.5–2s).

### Beat 3 — VACÍO / DROP ZONE · "Papel en reposo, listo"
- **Dónde:** zona de soltar archivos antes de cargar.
- **Aspect:** 4:3 o 1:1 (según contenedor).
- **Keyframe (Soul):**
  > A single document outline with a thick navy dashed border and a folded
  > corner, centered on warm paper, calm and waiting; subtle teal pulse on the
  > dashed edge. [+ cola anti-deriva]
- **Animación:** "respiración" mínima (escala 1.0↔1.01) + pulso teal en el borde.
  Muy lento, casi imperceptible.

### Fase 2 (después de validar el look)
- Acentos por módulo (Documentos vs Medios), transiciones entre herramientas.

---

## Integración en Next (cuando lleguen los clips)

- Formato: **WebM (VP9) + MP4 (H.264) fallback** + `poster` con el keyframe PNG.
- `loading="lazy"`, `muted`, `playsinline`, `loop`; pausar fuera de viewport.
- `prefers-reduced-motion: reduce` → mostrar **solo el poster estático**.
- Peso objetivo: ambiente = ligero. Loops cortos, recorte agresivo. El hero no
  debe retrasar la interacción con el catálogo (la app sigue siendo "al instante").

---

## Orden de producción (lean)

1. Generar **solo el Beat 1 (hero)** en Soul, iterar hasta que el look encaje.
2. Validar contra la UI real antes de producir Beats 2 y 3 (no producir los tres
   a ciegas).
3. Animar → integrar el hero → medir que no rompe velocidad → seguir.
