import type { Config } from "tailwindcss";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: {
				DEFAULT: '1rem',
				sm: '1.5rem',
				lg: '2rem',
				xl: '2.5rem',
			},
			screens: {
				sm: '640px',
				md: '768px',
				lg: '1024px',
				xl: '1280px',
				'2xl': '1400px'
			}
		},
		extend: {
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				'priority-medium': {
					DEFAULT: 'hsl(var(--priority-medium))',
					foreground: 'hsl(var(--priority-medium-foreground))'
				},
				'priority-low': {
					DEFAULT: 'hsl(var(--priority-low))',
					foreground: 'hsl(var(--priority-low-foreground))'
				},
				'status-pending': {
					DEFAULT: 'hsl(var(--status-pending))',
					foreground: 'hsl(var(--status-pending-foreground))'
				},
				'status-in-progress': {
					DEFAULT: 'hsl(var(--status-in-progress))',
					foreground: 'hsl(var(--status-in-progress-foreground))'
				},
				'status-completed': {
					DEFAULT: 'hsl(var(--status-completed))',
					foreground: 'hsl(var(--status-completed-foreground))'
				},
				'role-supervisor': {
					DEFAULT: 'hsl(var(--role-supervisor))',
					foreground: 'hsl(var(--role-supervisor-foreground))'
				},
				'role-coordenador': {
					DEFAULT: 'hsl(var(--role-coordenador))',
					foreground: 'hsl(var(--role-coordenador-foreground))'
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				},
				'custom-bg': 'hsl(var(--custom-bg))'
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			keyframes: {
				'accordion-down': {
					from: {
						height: '0'
					},
					to: {
						height: 'var(--radix-accordion-content-height)'
					}
				},
				'accordion-up': {
					from: {
						height: 'var(--radix-accordion-content-height)'
					},
					to: {
						height: '0'
					}
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out'
			},
			spacing: {
				'18': '4.5rem',
				'88': '22rem',
			},
			fontSize: {
				'xs': ['0.75rem', { lineHeight: '1rem' }],
				'sm': ['0.875rem', { lineHeight: '1.25rem' }],
				'base': ['1rem', { lineHeight: '1.5rem' }],
				'lg': ['1.125rem', { lineHeight: '1.75rem' }],
				'xl': ['1.25rem', { lineHeight: '1.75rem' }],
				'2xl': ['1.5rem', { lineHeight: '2rem' }],
				'3xl': ['1.875rem', { lineHeight: '2.25rem' }],
				'4xl': ['2.25rem', { lineHeight: '2.5rem' }],
				'responsive-sm': ['clamp(0.875rem, 2.5vw, 1rem)', { lineHeight: '1.4' }],
				'responsive-base': ['clamp(1rem, 3vw, 1.125rem)', { lineHeight: '1.5' }],
				'responsive-lg': ['clamp(1.125rem, 4vw, 1.25rem)', { lineHeight: '1.6' }],
				'responsive-xl': ['clamp(1.25rem, 5vw, 1.5rem)', { lineHeight: '1.7' }],
				'responsive-2xl': ['clamp(1.5rem, 6vw, 1.875rem)', { lineHeight: '1.3' }],
				'responsive-3xl': ['clamp(1.875rem, 8vw, 2.25rem)', { lineHeight: '1.2' }],
			},
			transitionProperty: {
				'theme': 'background-color, border-color, color, fill, stroke, opacity, box-shadow, transform, filter, backdrop-filter',
			},
			transitionDuration: {
				'theme': '150ms',
			},
			transitionTimingFunction: {
				'theme': 'cubic-bezier(0.4, 0, 0.2, 1)',
			}
		}
	},
	plugins: [require("tailwindcss-animate")],
} satisfies Config;
