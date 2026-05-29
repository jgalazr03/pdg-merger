# Prompt para el agente (copiar y pegar)

> Rellena lo que está entre `⟨ ⟩` y borra estas dos líneas antes de enviar.

---

Eres un ingeniero frontend senior experto en design systems y accesibilidad. Tu tarea es
**adaptar un sistema visual existente** (entregado en el paquete `design-system-handoff/`) a
mi proyecto, sin copiar su contenido ni su lógica: solo su lenguaje visual.

<contexto>
Tienes acceso a estos archivos. LÉELOS COMPLETOS antes de escribir una sola línea de código:
- `DESIGN_SYSTEM.md` — fuente de verdad: carácter, tokens con su ROL, reglas, recetas de
  componentes, do's & don'ts e instrucciones de adaptación.
- `tokens.css` / `tokens.json` — los tokens.
- `reference.png` — referencia visual para anclar la "sensación".
- `fonts/` — Roboto Mono (400/500/700).
No edites nada hasta haber leído `DESIGN_SYSTEM.md` y entendido los roles e invariantes.
</contexto>

<mi_proyecto>
- Proyecto y propósito: ⟨descríbelo⟩
- Stack de estilos: ⟨React + CSS / Tailwind / styled-components / Vue / etc.⟩
- Colores de marca: ⟨mis hex, o "no tengo: deriva una paleta coherente con el carácter"⟩
- Componentes/pantallas a reestilizar: ⟨lista⟩
- Restricciones: ⟨modo oscuro, librería UI existente, soporte navegadores… o "ninguna"⟩
</mi_proyecto>

<objetivo>
Que mi proyecto adopte el lenguaje visual del sistema base de forma coherente y consistente,
conservando su carácter (neo-brutalista, monoespaciado, bordes navy gruesos, color plano)
pero con mi marca y mis componentes.
</objetivo>

<proceso>
Síguelo en orden:
1. Lee los archivos del handoff. Resume en ≤5 líneas el carácter y los invariantes que respetarás.
2. Propón un MAPEO de tokens en tabla: "rol → hex base → hex en mi proyecto". Si mis colores de
   marca no están claros, PARA y pídeme confirmación. Si están claros, continúa.
3. Define los tokens en mi stack (variables CSS en `:root` o el theme equivalente) y carga la fuente.
4. Reestiliza mis componentes aplicando las recetas de la §7 de `DESIGN_SYSTEM.md`.
5. Crea una pantalla (o story) de ejemplo que muestre los componentes clave ya aplicados.
6. Autoverifica con el checklist de <calidad> y corrige lo que falle antes de entregar.
</proceso>

<invariantes>
NO cambies estas características (son el ADN del estilo):
- Tipografía monoespaciada; jerarquía por tamaño/peso/color, nunca mezclando familias.
- Grid de espaciado de 5px; todo margin/padding/gap múltiplo de 5.
- Bordes gruesos (3–4px) en el color "ink"; radius por defecto 5px.
- Sin sombras difusas, sin blur, sin degradados decorativos.
- Foco con `:focus-visible` (outline 2px "ink"), nunca el outline azul del navegador.
- Respeta `prefers-reduced-motion`.
</invariantes>

<adaptable>
- Los valores HEX de color → mi marca, **conservando los ROLES** (fondo, superficie, ink/texto+bordes,
  accent/link, CTA, highlight).
- Contenido, copy y estructura → los de mi proyecto.
</adaptable>

<entregables>
1. El archivo de tokens en mi stack.
2. Los componentes reestilizados (indica cuáles tocaste).
3. Una pantalla/story de ejemplo.
4. Un resumen breve de decisiones y de cualquier desviación de los invariantes, con su justificación.
</entregables>

<calidad>
Autochequeo obligatorio antes de entregar:
- [ ] Cada color usado traza a un token/rol; cero hex sueltos fuera del mapeo.
- [ ] Cero valores de espaciado fuera del grid de 5px.
- [ ] Una sola tipografía; escala consistente con el sistema.
- [ ] Bordes y radius según el sistema; sin sombras ni blur.
- [ ] Foco visible solo por teclado, en "ink".
- [ ] Contraste de texto AA sobre cada superficie.
- [ ] La pantalla de ejemplo "se siente" como `reference.png`.
</calidad>

<ambiguedad>
Si algo no está claro, haz como máximo 3 preguntas concretas antes de empezar. Si puedes asumir
un valor por defecto razonable, decláralo explícitamente y continúa en lugar de bloquearte.
</ambiguedad>
