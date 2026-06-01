import type { Config } from 'tailwindcss';
import plugin from 'tailwindcss/plugin';

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    // Grid de espaciado de 5px (invariante del sistema): cada paso = 5·n px,
    // los medios pasos redondean al múltiplo de 5 más cercano. Así TODO
    // margin/padding/gap/width/height de la app cae en la rejilla de 5px.
    spacing: {
      px: '1px',
      0: '0px',
      0.5: '5px',
      1: '5px',
      1.5: '10px',
      2: '10px',
      2.5: '15px',
      3: '15px',
      3.5: '20px',
      4: '20px',
      5: '25px',
      6: '30px',
      7: '35px',
      8: '40px',
      9: '45px',
      10: '50px',
      11: '55px',
      12: '60px',
      14: '70px',
      16: '80px',
      20: '100px',
      24: '120px',
      28: '140px',
      32: '160px',
      36: '180px',
      40: '200px',
      44: '220px',
      48: '240px',
      52: '260px',
      56: '280px',
      60: '300px',
      64: '320px',
      72: '360px',
      80: '400px',
      96: '480px',
    },
    extend: {
      fontFamily: {
        // Una sola familia monoespaciada (invariante). `sans` y `display`
        // apuntan a la misma var para que el markup heredado siga en mono.
        sans: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        display: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      // Curvas de Emil Kowalski (animations.dev): entradas con ease-out,
      // movimiento on-screen con ease-in-out.
      transitionTimingFunction: {
        'out-quint': 'cubic-bezier(0.22, 1, 0.36, 1)',
        'out-cubic': 'cubic-bezier(0.215, 0.61, 0.355, 1)',
        'in-out-quint': 'cubic-bezier(0.86, 0, 0.07, 1)',
      },
      // Mismas curvas pero para ANIMACIONES (keyframes). tailwindcss-animate
      // genera `ease-*` desde aquí aplicándolas a `animation-timing-function`, así
      // que `ease-out-quint` en un `animate-in` (overlays Radix) usa la curva
      // premium en vez del `ease` débil por defecto. (Las nativas linear/in/out/
      // in-out las aporta el plugin; aquí solo extendemos.)
      animationTimingFunction: {
        'out-quint': 'cubic-bezier(0.22, 1, 0.36, 1)',
        'out-cubic': 'cubic-bezier(0.215, 0.61, 0.355, 1)',
        'in-out-quint': 'cubic-bezier(0.86, 0, 0.07, 1)',
      },
      // Bordes navy gruesos = firma del estilo (3px controles, 4px paneles).
      borderWidth: {
        3: '3px',
        4: '4px',
      },
      // Radius del sistema: 5px por defecto, 20px en contenedores grandes.
      borderRadius: {
        none: '0px',
        sm: '5px',
        DEFAULT: '5px',
        md: '5px',
        lg: 'var(--radius)', // 5px
        xl: 'var(--radius-lg)', // 20px
        '2xl': 'var(--radius-lg)', // 20px
        full: '9999px',
      },
      colors: {
        brand: {
          navy: 'hsl(var(--brand-navy) / <alpha-value>)',
          ocean: 'hsl(var(--brand-ocean) / <alpha-value>)',
          red: 'hsl(var(--brand-red) / <alpha-value>)',
          teal: 'hsl(var(--brand-teal) / <alpha-value>)',
        },
        surface: 'hsl(var(--surface) / <alpha-value>)',
        panel: 'hsl(var(--panel) / <alpha-value>)',
        ink: 'hsl(var(--ink) / <alpha-value>)',
        // Rol "highlight": relleno de acento (cian del sistema base → teal GAINCO)
        highlight: {
          DEFAULT: 'hsl(var(--highlight) / <alpha-value>)',
          soft: 'hsl(var(--highlight-soft) / <alpha-value>)',
        },
        // Tintes suaves por herramienta (cajas de ayuda), mismo registro que highlight-soft.
        'ocean-soft': 'hsl(var(--ocean-soft) / <alpha-value>)',
        'amber-soft': 'hsl(var(--amber-soft) / <alpha-value>)',
        'indigo-soft': 'hsl(var(--indigo-soft) / <alpha-value>)',
        'fuchsia-soft': 'hsl(var(--fuchsia-soft) / <alpha-value>)',
        'violet-soft': 'hsl(var(--violet-soft) / <alpha-value>)',
        'sky-soft': 'hsl(var(--sky-soft) / <alpha-value>)',
        'cyan-soft': 'hsl(var(--cyan-soft) / <alpha-value>)',
        'blue-soft': 'hsl(var(--blue-soft) / <alpha-value>)',
        'emerald-soft': 'hsl(var(--emerald-soft) / <alpha-value>)',
        'green-soft': 'hsl(var(--green-soft) / <alpha-value>)',
        'orange-soft': 'hsl(var(--orange-soft) / <alpha-value>)',
        'rose-soft': 'hsl(var(--rose-soft) / <alpha-value>)',
        'purple-soft': 'hsl(var(--purple-soft) / <alpha-value>)',
        'pink-soft': 'hsl(var(--pink-soft) / <alpha-value>)',
        'slate-soft': 'hsl(var(--slate-soft) / <alpha-value>)',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        success: {
          DEFAULT: 'hsl(var(--success) / <alpha-value>)',
          foreground: 'hsl(var(--success-foreground) / <alpha-value>)',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning) / <alpha-value>)',
          foreground: 'hsl(var(--warning-foreground) / <alpha-value>)',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
        },
      },
      keyframes: {
        'accordion-down': {
          from: {
            height: '0',
          },
          to: {
            height: 'var(--radix-accordion-content-height)',
          },
        },
        'accordion-up': {
          from: {
            height: 'var(--radix-accordion-content-height)',
          },
          to: {
            height: '0',
          },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        // Entradas con propósito y duración corta (HIG: motion <300ms),
        // easing premium tipo "ease-out-quint".
        'fade-in': 'fade-in 0.25s cubic-bezier(0.22, 1, 0.36, 1) both',
        'slide-up': 'slide-up 0.3s cubic-bezier(0.22, 1, 0.36, 1) both',
      },
    },
  },
  plugins: [
    require('tailwindcss-animate'),
    // Tailwind v3 NO auto-gatea `hover:` (solo v4). Esta variante aplica el hover
    // SOLO en punteros finos con hover real, evitando el hover "pegajoso" tras un
    // toque en móvil/tablet (Emil: filtrar el hover en táctil). Misma convención
    // que el `@media (pointer: fine)` ya usado en globals.css.
    plugin(({ addVariant }) => {
      addVariant('hover-fine', '@media (hover: hover) and (pointer: fine) { &:hover }');
      // Igual que `group-hover` pero filtrado a punteros finos (para subrayados /
      // realces que dependen del hover del contenedor `.group`).
      addVariant(
        'group-hover-fine',
        '@media (hover: hover) and (pointer: fine) { :merge(.group):hover & }'
      );
    }),
  ],
};
export default config;
