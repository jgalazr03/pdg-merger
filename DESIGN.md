---
name: Herramientas GAINCO
description: Utilidades de documentos PDF y Excel, rápidas y sin fricción, con identidad GAINCO.
colors:
  gainco-navy: "#000044"
  gainco-ocean: "#004b7d"
  signal-red: "#c60014"
  signal-red-deep: "#b30012"
  warm-paper: "#fcfaf7"
  slate-ink: "#0f1729"
  muted-slate: "#5a647c"
  warm-border: "#e5e0dc"
  tool-amber: "#d97706"
  tool-teal: "#0d9488"
  success-green: "#16a34a"
  pure-white: "#ffffff"
typography:
  display:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "clamp(2rem, 5vw, 3.75rem)"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "clamp(1.875rem, 3vw, 2.25rem)"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.06em"
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  pill: "9999px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.signal-red}"
    textColor: "{colors.pure-white}"
    rounded: "{rounded.sm}"
    padding: "0 32px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.signal-red-deep}"
    textColor: "{colors.pure-white}"
  button-outline:
    backgroundColor: "{colors.warm-paper}"
    textColor: "{colors.slate-ink}"
    rounded: "{rounded.sm}"
    padding: "0 32px"
    height: "44px"
  card:
    backgroundColor: "{colors.pure-white}"
    textColor: "{colors.slate-ink}"
    rounded: "{rounded.lg}"
    padding: "24px"
  icon-tile:
    backgroundColor: "{colors.gainco-navy}"
    textColor: "{colors.pure-white}"
    rounded: "{rounded.xl}"
    size: "64px"
  dropzone:
    backgroundColor: "{colors.pure-white}"
    textColor: "{colors.slate-ink}"
    rounded: "{rounded.xl}"
    padding: "40px 24px"
---

# Design System: Herramientas GAINCO

## 1. Overview

**Creative North Star: "El taller de precisión"**

Herramientas que simplemente funcionan: exactas, fiables y sin ruido. La interfaz
es el banco de trabajo, no la pieza expuesta; cuando hace bien su trabajo,
desaparece y solo queda la tarea resuelta. La densidad es media-baja, con aire
generoso alrededor de un único foco por pantalla (la zona de carga, el panel de
opciones, el resultado). El tono es el de las mejores herramientas de producto
(Linear, Raycast): veloces, enfocadas, con cero adorno gratuito.

La identidad GAINCO entra con criterio, no como decoración: navy profundo como
tinta y estructura, un rojo de señal escaso pero inequívoco para la acción.
Tipografía con carácter técnico (Archivo en titulares, IBM Plex Sans en cuerpo)
que evita el aire de plantilla. La profundidad se construye por capas sutiles:
superficies con sombra mínima en reposo que se elevan al interactuar.

Este sistema **rechaza explícitamente el look de SaaS de plantilla genérico**:
gradientes morados sobre blanco, rejillas de cards idénticas (icono + título +
texto), el patrón "hero-metric", y cualquier cosa que se reconozca como "hecha
por IA". Si alguien pudiera decir eso sin dudar, el diseño falló.

**Key Characteristics:**
- La tarea primero: el camino subir → opciones → listo manda sobre todo lo demás.
- Tinta navy + acento rojo escaso; el rojo es señal, no relleno.
- Tipografía técnica (Archivo / IBM Plex Sans), nunca Inter ni genéricos.
- Capas con sombra sutil; nada plano-muerto, nada sobrecargado.
- Accesible por defecto: contraste AA, teclado, foco visible, reduced-motion.

## 2. Colors

Paleta sobria anclada en la marca: navy como tinta, un rojo de señal escaso, y
neutros cálidos que evitan el blanco/gris clínico.

### Primary
- **Rojo Señal GAINCO** (#c60014): la acción. CTAs primarios, estado activo del
  paso actual, indicador de navegación activa y anillo de foco. Es deliberadamente
  escaso: su rareza es lo que lo hace legible como "esto es lo importante".
- **Rojo Señal Profundo** (#b30012): solo el estado hover del CTA primario.

### Secondary
- **Navy GAINCO** (#000044): tinta y estructura. Titulares, tiles de íconos,
  footer, texto fuerte. Es el color que sostiene la jerarquía.
- **Océano GAINCO** (#004b7d): azul secundario para enlaces, eyebrows y el
  sub-acento de la herramienta "Unir".

### Tertiary
- **Ámbar Herramienta** (#d97706) y **Teal Herramienta** (#0d9488): sub-acentos
  sutiles que distinguen "Dividir" y "Comprimir" — solo en el glifo del ícono,
  una línea fina y tintes suaves. Nunca recolorean el cromo principal.
- **Verde Éxito** (#16a34a): exclusivo de estados de éxito/confirmación.

### Neutral
- **Papel Cálido** (#fcfaf7): superficie base de la app, tibia, no blanca clínica.
- **Tinta Pizarra** (#0f1729): texto de cuerpo principal sobre superficies claras.
- **Pizarra Apagada** (#5a647c): texto secundario, ayudas, metadatos.
- **Borde Cálido** (#e5e0dc): bordes, divisores, contornos de tarjetas.

Los neutros y la marca se definen canónicamente en HSL como custom properties en
`app/globals.css` (p. ej. navy `240 100% 13%`, rojo `354 100% 39%`); los hex de
arriba son su equivalente para herramientas que validan sRGB.

### Named Rules
**La Regla del Rojo Escaso.** El rojo de señal ocupa ≤10% de cualquier pantalla.
Vive en el CTA primario, el foco y el estado activo. Si aparece en más de un par
de sitios a la vez, se diluye y deja de significar "acción".

**La Regla del Sub-acento Callado.** El color por herramienta (océano/ámbar/teal)
solo toca el ícono, una línea fina y tintes suaves. Jamás pinta botones, fondos
grandes ni el cromo. La app es una, no tres apps de colores distintos.

## 3. Typography

**Display Font:** Archivo (con system-ui, sans-serif)
**Body Font:** IBM Plex Sans (con system-ui, sans-serif)

**Character:** Archivo aporta una grotesca industrial con presencia, coherente con
el carácter técnico/ingenieril de GAINCO; IBM Plex Sans es humanista y precisa,
distintiva sin gritar. El emparejamiento se siente de "instrumento", no de
plantilla de marketing.

### Hierarchy
- **Display** (800, clamp 2–3.75rem, lh 1.05, tracking -0.02em): titular de la
  landing. Permite una palabra clave en rojo de señal para énfasis.
- **Headline** (800, 1.875–2.25rem, lh 1.1): H1 de cada herramienta en navy.
- **Title** (700, 1.125rem, lh 1.3): títulos de sección/tarjeta en navy.
- **Body** (400, 1rem, lh 1.6): texto general en tinta pizarra. Línea máx. 65–75ch.
- **Label** (600, 0.75rem, tracking 0.06em, MAYÚSCULAS): eyebrows y etiquetas
  pequeñas en Archivo.

### Named Rules
**La Regla Anti-Inter.** Nunca Inter, Roboto, Arial ni system-ui como fuente de
marca. Archivo + IBM Plex Sans son la voz; cualquier reversión a una grotesca
genérica delata el "look de IA".

## 4. Elevation

Sistema de **capas con profundidad sutil**: las superficies no son planas-muertas
ni cargadas de sombras. Las tarjetas y la zona de carga llevan una sombra mínima
en reposo (`shadow-sm`) que las separa apenas del papel cálido, y se elevan de
forma contenida al interactuar. La atmósfera global (un halo navy/océano y un
grano finísimo, fijos detrás del contenido) aporta textura sin competir.

### Shadow Vocabulary
- **Reposo** (`box-shadow: 0 1px 2px 0 rgba(0,0,68,0.05)`): tarjetas y dropzone en
  estado base.
- **Elevada en hover** (`box-shadow: 0 10px 24px -6px rgba(0,0,68,0.10)`): tarjetas
  interactivas (landing) y dropzone al pasar el cursor; tinte navy, nunca negro puro.

### Named Rules
**La Regla del Tinte Navy.** Las sombras se tiñen hacia el navy de marca
(`rgba(0,0,68,…)`), nunca negro neutro. Profundidad cálida, coherente con la marca.

## 5. Components

### Buttons
- **Shape:** esquinas suaves (6px, `rounded-md`).
- **Primary:** fondo Rojo Señal (#c60014), texto blanco, alto 44px, padding 0 32px.
- **Hover / Focus:** hover a Rojo Señal Profundo; foco con anillo rojo de 2px y
  offset. Pulsación con `scale(0.98)` para feedback táctil.
- **Outline / Ghost:** fondo papel/blanco con borde cálido o sin fondo; para
  acciones secundarias (Limpiar, Cambiar archivo, Procesar otro).

### Cards / Containers
- **Corner Style:** 12px (`rounded-lg`) en tarjetas de contenido; 16px (`rounded-xl`)
  en zona de carga y tiles.
- **Background:** blanco sobre papel cálido.
- **Shadow Strategy:** ver Elevación (sutil en reposo, elevada en hover).
- **Border:** Borde Cálido (#e5e0dc), 1px.
- **Internal Padding:** 24px (`p-6`).

### Inputs / Fields
- **Style:** borde cálido 1px, fondo blanco, radио 6–8px.
- **Focus:** anillo rojo de señal (mismo token que el foco global), nunca azul de
  navegador por defecto.
- **Error:** borde rojo y mensaje en texto; el estado se comunica con texto + color,
  no solo color.

### Navigation
- **Header:** sticky, papel translúcido con desenfoque, logo a color a la izquierda.
- **Active:** texto navy + **subrayado rojo de 2px** (no un "pill" de color); en
  móvil, punto rojo. Inactivo: pizarra apagada → navy en hover.

### Icon Tile (signature)
Tile navy de 64px (`rounded-xl`) con el glifo de la herramienta en blanco y un
pequeño acento rojo bajo él. Reemplaza el cliché del "cuadrito pastel con line-icon".

### Step Indicator (signature)
Banda Subir → Opciones → Listo: círculo rojo (paso actual) / navy con check
(completado) / neutro (pendiente). Comunica progreso por forma + color + texto.

### File Dropzone (signature)
Una sola caja (sin doble borde) con borde discontinuo, chip de ícono navy y CTA
rojo. Accesible por teclado (`role="button"`, Enter/Espacio) y con acento rojo al
arrastrar. Es el corazón de cada herramienta.

## 6. Do's and Don'ts

### Do:
- **Do** reservar el rojo de señal (#c60014) para acción/foco/estado activo: ≤10%
  de la pantalla (La Regla del Rojo Escaso).
- **Do** usar navy (#000044) como tinta y estructura, y neutros cálidos (papel
  #fcfaf7) en vez de blanco/gris clínico.
- **Do** titular con Archivo y redactar con IBM Plex Sans; jerarquía por escala +
  peso (ratio ≥1.25).
- **Do** teñir las sombras hacia el navy y mantenerlas sutiles en reposo.
- **Do** comunicar cada estado (progreso, éxito, error) con más de un canal, no
  solo color; foco visible y soporte de teclado siempre.

### Don't:
- **Don't** caer en el **SaaS de plantilla genérico**: gradientes morados sobre
  blanco, rejillas de cards idénticas (icono + título + texto), el patrón
  "hero-metric", ni nada que se vea "hecho por IA".
- **Don't** usar Inter, Roboto, Arial ni system-ui como fuente de marca.
- **Don't** pintar el cromo con el color por herramienta: el océano/ámbar/teal solo
  van en ícono, línea fina y tintes (La Regla del Sub-acento Callado).
- **Don't** usar negro puro (#000) ni sombras negras neutras; ni `border-left`/
  `right` >1px como franja de color de acento.
- **Don't** meter texto con gradiente (`background-clip: text`) ni glassmorphism
  decorativo; ni resolver con modal lo que se puede hacer inline.

