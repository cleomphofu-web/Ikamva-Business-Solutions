/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
  	extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		colors: {
  			background: 'var(--background)',
  			foreground: 'var(--foreground)',
  			card: {
  				DEFAULT: 'var(--card)',
  				foreground: 'var(--card-foreground)'
  			},
  			popover: {
  				DEFAULT: 'var(--popover)',
  				foreground: 'var(--popover-foreground)'
  			},
  			primary: {
  				DEFAULT: 'var(--primary)',
  				foreground: 'var(--primary-foreground)'
  			},
  			secondary: {
  				DEFAULT: 'var(--secondary)',
  				foreground: 'var(--secondary-foreground)'
  			},
  			muted: {
  				DEFAULT: 'var(--muted)',
  				foreground: 'var(--muted-foreground)'
  			},
  			accent: {
  				DEFAULT: 'var(--accent)',
  				foreground: 'var(--accent-foreground)'
  			},
  			destructive: {
  				DEFAULT: 'var(--destructive)',
  				foreground: 'var(--destructive-foreground)'
  			},
  			border: 'var(--border)',
  			input: 'var(--input)',
  			ring: 'var(--ring)',
        dark_coffee: { DEFAULT: '#352208', 100: '#0b0702', 200: '#150e03', 300: '#201505', 400: '#2b1b06', 500: '#352208', 600: '#835514', 700: '#d1871f', 800: '#e8b063', 900: '#f3d8b1' },
        soft_fawn: { DEFAULT: '#e1bb80', 100: '#39280d', 200: '#724f1b', 300: '#ab7728', 400: '#d49b46', 500: '#e1bb80', 600: '#e7c899', 700: '#edd5b2', 800: '#f3e3cc', 900: '#f9f1e5' },
        olive_wood: { DEFAULT: '#7b6b43', 100: '#18150d', 200: '#312a1b', 300: '#494028', 400: '#615536', 500: '#7b6b43', 600: '#a38e5a', 700: '#bbab83', 800: '#d1c7ac', 900: '#e8e3d6' },
        olive_bark: { DEFAULT: '#685634', 100: '#15110b', 200: '#2a2315', 300: '#3f3420', 400: '#54462a', 500: '#685634', 600: '#987e4d', 700: '#b8a073', 800: '#d0c0a1', 900: '#e7dfd0' },
        warm_olive: { DEFAULT: '#806443', 100: '#19140d', 200: '#33281b', 300: '#4c3b28', 400: '#664f35', 500: '#806443', 600: '#a88359', 700: '#bea283', 800: '#d3c1ac', 900: '#e9e0d6' },
  			chart: {
  				'1': 'var(--chart-1)',
  				'2': 'var(--chart-2)',
  				'3': 'var(--chart-3)',
  				'4': 'var(--chart-4)',
  				'5': 'var(--chart-5)'
  			},
  			sidebar: {
  				DEFAULT: 'var(--sidebar-background)',
  				foreground: 'var(--sidebar-foreground)',
  				primary: 'var(--sidebar-primary)',
  				'primary-foreground': 'var(--sidebar-primary-foreground)',
  				accent: 'var(--sidebar-accent)',
  				'accent-foreground': 'var(--sidebar-accent-foreground)',
  				border: 'var(--sidebar-border)',
  				ring: 'var(--sidebar-ring)'
  			},
        glow: {
          primary: 'var(--glow-primary)',
          secondary: 'var(--glow-secondary)',
        },
        surface: {
          DEFAULT: 'var(--surface)',
          strong: 'var(--surface-strong)',
          glass: 'var(--surface-glass)',
        }
  		},
  		keyframes: {
  			'accordion-down': {
  				from: { height: '0' },
  				to: { height: 'var(--radix-accordion-content-height)' }
  			},
  			'accordion-up': {
  				from: { height: 'var(--radix-accordion-content-height)' },
  				to: { height: '0' }
  			},
        'ikamva-fade-in': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' }
        },
        'ikamva-slide-in': {
          from: { opacity: '0', transform: 'translateX(-16px)' },
          to: { opacity: '1', transform: 'translateX(0)' }
        },
        'ikamva-scale-in': {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to: { opacity: '1', transform: 'scale(1)' }
        },
        'ikamva-breathe': {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.75' },
          '50%': { transform: 'scale(1.06)', opacity: '1' }
        },
        'ikamva-halo': {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' }
        },
        'ikamva-attention': {
          '0%, 100%': { boxShadow: '0 0 0 0 hsla(var(--state-approval), 0.35)' },
          '50%': { boxShadow: '0 0 0 12px hsla(var(--state-approval), 0)' }
        },
        'ikamva-drift': {
          '0%': { transform: 'translate3d(0, 0, 0) scale(1)' },
          '50%': { transform: 'translate3d(4%, -5%, 0) scale(1.12)' },
          '100%': { transform: 'translate3d(0, 0, 0) scale(1)' }
        },
        'ikamva-dot': {
          '0%, 80%, 100%': { opacity: '0.25', transform: 'translateY(0)' },
          '40%': { opacity: '1', transform: 'translateY(-3px)' }
        },
        'ikamva-sweep': {
          from: { backgroundPosition: '0% 50%' },
          to: { backgroundPosition: '200% 50%' }
        }
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-in': 'ikamva-fade-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) both',
        'slide-in': 'ikamva-slide-in 0.45s cubic-bezier(0.22, 1, 0.36, 1) both',
        'scale-in': 'ikamva-scale-in 0.35s cubic-bezier(0.22, 1, 0.36, 1) both',
        'breathe': 'ikamva-breathe 4.5s ease-in-out infinite',
        'halo': 'ikamva-halo 14s linear infinite',
        'attention': 'ikamva-attention 2.6s ease-out infinite',
        'drift': 'ikamva-drift 26s ease-in-out infinite',
        'sweep': 'ikamva-sweep 2.4s linear infinite'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
}
