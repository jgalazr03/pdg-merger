# Design System — base "react-spring-visualizer"

Spec portable para adaptar este sistema visual a otro proyecto.
El agente debe **conservar los roles y reglas**, no copiar pantallas.

## 1. Carácter

Retro / **neo-brutalista**, claro y técnico:
- Tipografía **monoespaciada** (Roboto Mono) en todo.
- **Bloques de color plano** + **bordes navy gruesos (3–4px)**.
- Esquinas suaves (radius 5px).
- **Sin** sombras difusas, **sin** blur, **sin** degradados decorativos.
- Acentos puntuales: azul (links/activo), rosa (CTA), cian (relleno destacado).

## 2. Color (rol > hex)

| Token | Hex | Rol |
|---|---|---|
| `bg` | `#fef6e4` | Fondo de página (crema) |
| `surface` | `#f3d2c1` | Tarjetas, paneles, barras (durazno) |
| `ink` | `#001858` | Texto principal **y todos los bordes** (navy) |
| `accent` | `#0000ee` | Links, estado activo, foco de marca (azul) |
| `muted` | `#aaaaaa` | Texto secundario, placeholders |
| `highlight` | `#8bd3dd` | Relleno de acento / elementos destacados (cian) |
| `cta` | `#f582ae` | Botón de acción principal / destructivo (rosa) |

> Al adaptar a otra marca: cambia los **hex** pero respeta los **roles** (un fondo claro, una superficie, una tinta oscura para texto+bordes, un acento de link, un CTA, un highlight).

## 3. Tipografía

- Familia única: **Roboto Mono** (400 / 500 / 700). Jerarquía por tamaño/peso/color, **nunca** mezclando fuentes.
- Escala: H1 `3rem/700` · H2 `24px/700` · H3 `18px/700` · label `20px` · input `16px` · aux `14px`.
- Interlineado: 1.5 cuerpo, 1.1 títulos.

## 4. Espaciado y layout

- **Grid de 5px**: todo margin/padding/gap es múltiplo de 5 (`5,10,15,20,30,40,60`).
- Contenedor centrado, max-width ~`1000px`.
- Mobile-first.

## 5. Radius y bordes

- Radius por defecto `5px` (contenedores grandes `20px`).
- **Bordes navy gruesos** = firma del estilo: `3px` en controles, `4px` en paneles.

## 6. Foco y movimiento

- Foco: **sin** el outline azul del navegador. Usar `:focus-visible { outline: 2px solid ink; outline-offset: 2px }` (solo teclado).
- Transiciones cortas `150–200ms ease`. Para microinteracciones físicas, `react-spring` (`useSpring` con `{mass, tension, friction}`) — opcional.
- Respetar `prefers-reduced-motion`.

## 7. Recetas de componentes

```css
/* Botón primario (CTA) */
.btn-primary { background: var(--color-cta); color: var(--color-ink);
  border: var(--border-control); border-radius: var(--radius);
  font: 700 18px var(--font-mono); padding: 12px 26px; cursor: pointer; }
.btn-primary:hover { opacity: .85; }

/* Botón ícono (cuadrado) */
.btn-icon { background: var(--color-bg); border: var(--border-control);
  border-radius: var(--radius); width: 54px; height: 54px;
  display: inline-flex; align-items: center; justify-content: center; }

/* Input / select */
.input { background: var(--color-bg); border: var(--border-control);
  border-radius: var(--radius); color: var(--color-ink);
  font: var(--fs-md) var(--font-mono); padding: 7px 10px; }

/* Panel / tarjeta */
.panel { background: var(--color-surface); border: var(--border-panel);
  border-radius: var(--radius); }

/* Slider (range): track navy fino + thumb crema con borde navy */
input[type=range]::-webkit-slider-runnable-track { height: 4px; background: var(--color-ink); border-radius: 2px; }
input[type=range]::-webkit-slider-thumb { width: 20px; height: 20px; border-radius: 50%;
  background: var(--color-surface); border: var(--border-control); }
```

## 8. Do's & Don'ts

**Do**
- Usa la tinta navy para texto y bordes por igual.
- Bordes gruesos y planos; deja respirar el fondo crema.
- Color de acento (rosa/cian/azul) con moderación, para jerarquía.

**Don't**
- ❌ Sombras suaves, blur, glassmorphism.
- ❌ Mezclar tipografías o salirte de la paleta.
- ❌ Valores de espaciado fuera del grid de 5px.
- ❌ El outline azul del navegador en foco.

## 9. Cómo adaptar (instrucciones para el agente)

1. Mapea los **roles** de color a la nueva marca (no copies los hex tal cual).
2. Mantén tipografía mono, grid de 5px, bordes gruesos y radius 5px como **invariantes del estilo**.
3. Aplica las recetas de §7 a los componentes reales del proyecto destino.
4. No traigas lógica/contenido del proyecto origen (era específico); solo el sistema visual.
