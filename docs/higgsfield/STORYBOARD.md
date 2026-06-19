# Storyboard — Experiencia "El Orden Instantáneo"

## Concepto (el motivo firma)

Todo el producto en un gesto: **el desorden que se resuelve en orden, al
instante.** No una pila de hojas (literal, caricaturesco), sino **una sola hoja**
cuyo contenido —texto reducido a trazos navy— pasa de *desalineado* a
*perfectamente alineado*, con **un único acento teal en el instante de
resolución**. Reductivo, preciso, con el alma de "documento" intacta.

Tono de referencia (de PRODUCT.md): **Linear / Raycast** — rápido, enfocado, cero
ruido. El cromo **acompaña, nunca compite** con la tarea. Test anti-slop: si
parece "hecho por IA", falló.

## El motivo se vuelve sistema

El mismo gesto se repite en tres momentos → cohesión "hecho por un solo equipo":

1. **Hero** — el *resolve* como **figura de línea, sin fondo**, una vez al llegar. ✅ HECHO: `components/ResolveFigure.tsx` (variantes `documents` y `medios`).
2. **Procesando** — los trazos a medio alinear, en loop sutil (el trabajo ocurriendo). Pendiente.
3. **Listo** — trazos cuadrados + tick teal de confirmación. Pendiente.

## Pipeline (quién hace qué)

- **Higgsfield = exploración y definición del look.** Recraft 4.1 (vector, paleta
  bloqueada) para generar bocetos rápidos y *especificar* la estética. Los
  bocetos viven en `docs/higgsfield/keyframes/`. El boceto guía es
  `hero-v3-resolve/order-2` (la hoja resuelta + marca teal).
- **Código = el movimiento que importa.** Un motivo geométrico tan preciso se
  anima en SVG/React (no en video de IA): cada trazo se alinea con
  `ease-out-expo`, timing perfecto, ~0 KB, paleta exacta, anti-slop total. Kling
  interpolaría geometría fina con artefactos y pesaría MB.
  (Higgsfield/Kling se reserva para piezas ricas/texturadas, no para esto.)

## Dirección de arte

- **Menos elementos, más grandes.** El papel respira (mucho espacio negativo).
- **Encuadre estable**, solo cambia el *orden* → un *snap* elegante, no un revoltijo.
- **Mono estricto:** navy `#000044` + papel `#fcfaf7`; teal `#0d9488` SOLO como el
  beat de resolución (Regla del Sub-acento Callado). **Cero rojo** (acción, ≤10%).
- **Movimiento:** `cubic-bezier(0.16,1,0.3,1)` (ease-out-expo), asentamiento
  confiado, sin bounce. Solo `transform`/`opacity`. `prefers-reduced-motion` →
  estado resuelto fijo, sin animación.
- Marco: hoja con borde navy grueso (`border-4 border-ink`, `rounded-lg`), como
  los paneles del sistema.

## Estado y limpieza

- **Aterrizaje final:** el motivo vive como **figura de línea sin fondo**
  (`ResolveFigure`), navy sobre papel, en documentos (`app/page.tsx`) y medios
  (`app/medios/page.tsx`). Se descartaron en el camino: la versión flat con marco
  (HeroResolve/MediosResolve) y el hero "stage" oscuro tipo Railway (HeroStage) —
  rompía el lenguaje neo-brutalista. Todos borrados.
- **Sin uso / a borrar:** `public/higgsfield/hero/*` (~5 MB, video del intento 1),
  `components/AmbientMedia.tsx`, `components/ResolveSpinner.tsx` (micro-motivo para
  estados "procesando", opcional/pendiente).
- Bocetos de exploración (registro de diseño): `docs/higgsfield/keyframes/`.
