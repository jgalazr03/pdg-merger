# Handoff — Design System base "react-spring-visualizer"

Este paquete es **autocontenido y portable**. Entrégalo completo al agente de IA del
proyecto destino para que adapte este sistema visual.

## Contenido

| Archivo | Qué es |
|---|---|
| `DESIGN_SYSTEM.md` | **El documento clave**: carácter, tokens con su rol, reglas, recetas de componentes, do's & don'ts e instrucciones de adaptación. |
| `tokens.css` | Variables CSS listas para pegar en `:root`. |
| `tokens.json` | Los mismos tokens en formato máquina (por si genera su propio theme). |
| `reference.png` | Captura de referencia para anclar la "sensación" visual. |
| `fonts/` | Roboto Mono (400/500/700). Alternativa: Google Fonts. |

## Cómo usarlo

1. Da el paquete completo al agente.
2. Usa el prompt de **`PROMPT.md`** (rellena lo que está entre `⟨ ⟩` y pégaselo). Ese es el
   prompt canónico, con proceso, invariantes, entregables y autochequeo.

## Nota

Estos tokens son la versión **verificada** (la que quedó tras afinar el clon), no la salida
cruda de skillui. Si el proyecto destino también usa Claude Code, como alternativa puedes
soltar el archivo `react-spring-visualizer-design/react-spring-visualizer-design.skill`
y el agente lo leerá automáticamente — pero este paquete destilado es más limpio.
