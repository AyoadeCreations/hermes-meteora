/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // ── Modern Dark Cinema palette (UI/UX Pro Max #71) ──────────────
        bg: {
          deep:    '#020203',   // root — near-OLED black
          base:    '#050506',   // page background
          surface: '#0a0a0c',   // card / panel surface
          elevated:'#111116',   // elevated panels
          overlay: '#18181f',   // modals, popovers
          muted:   '#1c1c24',   // muted cells, table alt rows
        },
        border: {
          DEFAULT: 'rgba(255,255,255,0.08)',
          subtle:  'rgba(255,255,255,0.04)',
          strong:  'rgba(255,255,255,0.14)',
          accent:  'rgba(94,106,210,0.35)',
        },
        text: {
          primary:   '#EDEDEF',
          secondary: '#9899A6',
          tertiary:  '#5C5D6E',
          disabled:  '#3a3a50',
          inverse:   '#020203',
        },
        // Indigo accent — primary interactive color
        accent: {
          DEFAULT:  '#5E6AD2',
          hover:    '#7B86DB',
          muted:    'rgba(94,106,210,0.15)',
          subtle:   'rgba(94,106,210,0.08)',
          glow:     'rgba(94,106,210,0.25)',
        },
        // Status
        success: {
          DEFAULT: '#2da44e',
          muted:   'rgba(45,164,78,0.15)',
        },
        warning: {
          DEFAULT: '#d97706',
          muted:   'rgba(217,119,6,0.15)',
        },
        danger: {
          DEFAULT: '#e5534b',
          muted:   'rgba(229,83,75,0.15)',
        },
        // Data viz palette — WCAG-safe on dark
        chart: {
          a: '#5E6AD2',  // indigo   — Design A
          b: '#2da44e',  // green    — Design B
          c: '#d97706',  // amber    — Design C
          d: '#e5534b',  // red      — Design D / actual
          e: '#a371f7',  // purple   — extra
          grid: 'rgba(255,255,255,0.06)',
        },
      },

      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains)', 'Menlo', 'monospace'],
      },

      fontSize: {
        '2xs': ['0.625rem',  { lineHeight: '0.875rem' }],
        xs:    ['0.75rem',   { lineHeight: '1rem' }],
        sm:    ['0.8125rem', { lineHeight: '1.125rem' }],
        base:  ['0.875rem',  { lineHeight: '1.375rem' }],
        md:    ['0.9375rem', { lineHeight: '1.5rem' }],
        lg:    ['1rem',      { lineHeight: '1.625rem' }],
        xl:    ['1.125rem',  { lineHeight: '1.75rem' }],
        '2xl': ['1.25rem',   { lineHeight: '1.875rem' }],
        '3xl': ['1.5rem',    { lineHeight: '2rem' }],
        '4xl': ['1.875rem',  { lineHeight: '2.25rem' }],
        '5xl': ['2.25rem',   { lineHeight: '2.75rem' }],
      },

      borderRadius: {
        sm:      '6px',
        DEFAULT: '8px',
        md:      '10px',
        lg:      '12px',
        xl:      '16px',
        '2xl':   '20px',
      },

      boxShadow: {
        // Elevation system — ambient only, no hard offsets
        sm:       '0 1px 2px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04)',
        card:     '0 2px 8px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)',
        elevated: '0 8px 24px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.08)',
        // Accent glow — used on primary interactive elements
        glow:     '0 0 0 1px rgba(94,106,210,0.4), 0 4px 16px rgba(94,106,210,0.2)',
        'glow-sm':'0 0 0 1px rgba(94,106,210,0.3), 0 2px 8px rgba(94,106,210,0.15)',
        // Inner top-edge shine for cards
        shine:    'inset 0 1px 0 rgba(255,255,255,0.06)',
      },

      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      },

      backgroundImage: {
        // Subtle gradient used on the page body
        'page-gradient': 'linear-gradient(160deg, #0d0d14 0%, #020203 60%)',
        // Card top-edge shimmer
        'card-shine':    'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, transparent 100%)',
        // Accent gradient for primary buttons
        'accent-gradient': 'linear-gradient(135deg, #6674e0 0%, #5E6AD2 100%)',
      },

      animation: {
        'fade-in':      'fadeIn 150ms cubic-bezier(0.16,1,0.3,1)',
        'slide-up':     'slideUp 200ms cubic-bezier(0.16,1,0.3,1)',
        'slide-in':     'slideIn 250ms cubic-bezier(0.16,1,0.3,1)',
        'pulse-slow':   'pulse 3s ease-in-out infinite',
        'glow-pulse':   'glowPulse 2.5s ease-in-out infinite',
        'blob-drift':   'blobDrift 8s ease-in-out infinite alternate',
      },

      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          from: { opacity: '0', transform: 'translateX(-8px)' },
          to:   { opacity: '1', transform: 'translateX(0)' },
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 0 1px rgba(94,106,210,0.3), 0 4px 16px rgba(94,106,210,0.15)' },
          '50%':      { boxShadow: '0 0 0 1px rgba(94,106,210,0.5), 0 4px 24px rgba(94,106,210,0.3)' },
        },
        blobDrift: {
          from: { transform: 'translate(0, 0) scale(1)' },
          to:   { transform: 'translate(30px, -20px) scale(1.05)' },
        },
      },

      transitionTimingFunction: {
        // UI/UX Pro Max easing: Bezier(0.16,1,0.3,1)
        'cinema': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
};
