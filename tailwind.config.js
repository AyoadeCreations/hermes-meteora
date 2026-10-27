/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // ── Aurora Editorial: ink on white, one atmospheric gradient ─────────
        // Token names are unchanged from the dark system so every page flips
        // with the palette; only the values moved.
        bg: {
          deep:     '#FFFFFF',   // root
          base:     '#FFFFFF',   // page
          surface:  '#FFFFFF',   // cards
          elevated: '#F6F5F2',   // raised / hover wash (warm paper)
          overlay:  '#FFFFFF',   // modals, popovers
          muted:    '#F0EFEB',   // inputs, muted cells, zebra rows
        },
        border: {
          DEFAULT: 'rgba(12,12,20,0.09)',
          subtle:  'rgba(12,12,20,0.05)',
          strong:  'rgba(12,12,20,0.18)',
          accent:  'rgba(106,61,240,0.40)',
        },
        text: {
          primary:   '#0B0B10',
          secondary: '#54555F',
          tertiary:  '#85868F',
          disabled:  '#BDBEC6',
          inverse:   '#FFFFFF',
        },
        // Ink is the primary interactive colour (buttons, active states).
        // `accent` is the one sharp highlight: electric violet, drawn from the aurora.
        ink: {
          DEFAULT: '#0B0B10',
          soft:    '#1A1A22',
        },
        accent: {
          DEFAULT: '#6A3DF0',
          hover:   '#5528D8',
          muted:   'rgba(106,61,240,0.09)',
          subtle:  'rgba(106,61,240,0.05)',
          glow:    'rgba(106,61,240,0.22)',
        },
        success: { DEFAULT: '#0C8F5A', muted: 'rgba(12,143,90,0.09)' },
        warning: { DEFAULT: '#B96A0A', muted: 'rgba(185,106,10,0.10)' },
        danger:  { DEFAULT: '#D0343A', muted: 'rgba(208,52,58,0.08)' },
        // Aurora stops, used for gradients and chart series
        aurora: {
          amber:   '#FFB347',
          ember:   '#FF6A3D',
          rose:    '#F0368C',
          violet:  '#6A3DF0',
          sky:     '#4F7CFF',
        },
        // Data viz: four distinguishable series that read on white
        chart: {
          a: '#6A3DF0',  // violet
          b: '#F0368C',  // magenta
          c: '#FF6A3D',  // ember
          d: '#0B0B10',  // ink
          e: '#4F7CFF',  // sky
          grid: 'rgba(12,12,20,0.06)',
        },
      },

      fontFamily: {
        sans:  ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono:  ['var(--font-geist-mono)', 'ui-monospace', 'Menlo', 'monospace'],
        serif: ['"Instrument Serif"', 'Georgia', 'serif'],
      },

      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
        xs:    ['0.75rem',   { lineHeight: '1.125rem' }],
        sm:    ['0.8125rem', { lineHeight: '1.25rem' }],
        base:  ['0.9375rem', { lineHeight: '1.5rem' }],
        md:    ['1rem',      { lineHeight: '1.625rem' }],
        lg:    ['1.0625rem', { lineHeight: '1.75rem' }],
        xl:    ['1.1875rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.375rem',  { lineHeight: '1.875rem' }],
        '3xl': ['1.75rem',   { lineHeight: '2.125rem', letterSpacing: '-0.02em' }],
        '4xl': ['2.25rem',   { lineHeight: '2.5rem',   letterSpacing: '-0.03em' }],
        '5xl': ['3rem',      { lineHeight: '1.02',     letterSpacing: '-0.04em' }],
      },

      borderRadius: {
        sm:      '8px',
        DEFAULT: '10px',
        md:      '12px',
        lg:      '16px',
        xl:      '22px',
        '2xl':   '28px',
        '3xl':   '36px',
      },

      boxShadow: {
        sm:       '0 1px 2px rgba(12,12,20,0.05)',
        card:     '0 1px 2px rgba(12,12,20,0.04), 0 12px 32px -12px rgba(12,12,20,0.08)',
        elevated: '0 2px 4px rgba(12,12,20,0.05), 0 24px 56px -16px rgba(12,12,20,0.16)',
        glow:     '0 0 0 1px rgba(106,61,240,0.35), 0 12px 36px -8px rgba(106,61,240,0.35)',
        'glow-sm':'0 0 0 1px rgba(106,61,240,0.25), 0 6px 18px -6px rgba(106,61,240,0.30)',
        shine:    'inset 0 1px 0 rgba(255,255,255,0.9)',
      },

      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      },

      backgroundImage: {
        'page-gradient':   'none',
        'card-shine':      'none',
        'accent-gradient': 'linear-gradient(135deg, #6A3DF0 0%, #F0368C 100%)',
        // The signature: a wide, soft aurora band
        'aurora-band':
          'radial-gradient(60% 80% at 18% 55%, rgba(255,179,71,0.85) 0%, rgba(255,179,71,0) 70%),' +
          'radial-gradient(55% 90% at 50% 50%, rgba(240,54,140,0.80) 0%, rgba(240,54,140,0) 70%),' +
          'radial-gradient(55% 80% at 82% 55%, rgba(106,61,240,0.75) 0%, rgba(106,61,240,0) 70%)',
      },

      animation: {
        'fade-in':    'fadeIn 200ms cubic-bezier(0.16,1,0.3,1)',
        'slide-up':   'slideUp 420ms cubic-bezier(0.16,1,0.3,1) both',
        'slide-in':   'slideIn 300ms cubic-bezier(0.16,1,0.3,1)',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'glow-pulse': 'glowPulse 2.5s ease-in-out infinite',
        'blob-drift': 'blobDrift 14s ease-in-out infinite alternate',
        'aurora':     'auroraShift 18s ease-in-out infinite alternate',
        'draw':       'drawLine 1.6s cubic-bezier(0.16,1,0.3,1) both',
      },

      keyframes: {
        fadeIn:  { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(14px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          from: { opacity: '0', transform: 'translateX(-8px)' },
          to:   { opacity: '1', transform: 'translateX(0)' },
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 0 1px rgba(106,61,240,0.25), 0 6px 18px -6px rgba(106,61,240,0.25)' },
          '50%':      { boxShadow: '0 0 0 1px rgba(106,61,240,0.45), 0 10px 30px -6px rgba(106,61,240,0.40)' },
        },
        blobDrift: {
          from: { transform: 'translate(0, 0) scale(1)' },
          to:   { transform: 'translate(40px, -24px) scale(1.08)' },
        },
        auroraShift: {
          from: { transform: 'translate3d(-3%, 0, 0) scale(1)' },
          to:   { transform: 'translate3d(3%, -2%, 0) scale(1.06)' },
        },
        drawLine: {
          from: { strokeDashoffset: '1' },
          to:   { strokeDashoffset: '0' },
        },
      },

      transitionTimingFunction: {
        cinema: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
};
