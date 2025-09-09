/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Configuración personalizada para tu proyecto
      colors: {
        background: 'hsl(var(--color-background))',
        foreground: 'hsl(var(--color-foreground))',
      },
      gridTemplateColumns: {
        13: 'repeat(13, minmax(0, 1fr))',
      },
      screens: {
        xs: '480px',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
  corePlugins: {
    // Asegura que todas las utilidades estén disponibles
    position: true,
    inset: true,
    zIndex: true,
    // Habilita preflight (reseteo de estilos)
    preflight: true,
  },
  // Lista segura de clases que siempre deben incluirse
  safelist: [
    // Utilidades de posicionamiento
    'static', 'fixed', 'absolute', 'relative', 'sticky',
    // Utilidades de top/right/bottom/left
    'top-0', 'right-0', 'bottom-0', 'left-0',
    'top-1', 'right-1', 'bottom-1', 'left-1',
    'top-2', 'right-2', 'bottom-2', 'left-2',
    'top-4', 'right-4', 'bottom-4', 'left-4',
    'top-8', 'right-8', 'bottom-8', 'left-8',
    // Utilidades de z-index
    'z-0', 'z-10', 'z-20', 'z-30', 'z-40', 'z-50', 'z-auto',
    // Utilidades de display
    'block', 'inline-block', 'inline', 'flex', 'inline-flex', 'grid', 'inline-grid',
    // Utilidades de visibilidad
    'visible', 'invisible', 'hidden',
  ],
  // Configuración para el modo JIT (Just-In-Time)
  mode: 'jit',
  // Habilita todas las variantes por defecto
  variants: {
    extend: {
      position: ['responsive', 'hover', 'focus'],
      inset: ['responsive', 'hover', 'focus'],
      margin: ['responsive', 'hover', 'focus'],
      padding: ['responsive', 'hover', 'focus'],
      display: ['responsive', 'hover', 'focus'],
      visibility: ['responsive', 'hover', 'focus'],
      zIndex: ['responsive', 'hover', 'focus'],
    },
  },
};
