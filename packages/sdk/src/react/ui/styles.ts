/**
 * Sylphx SDK Styling System
 *
 * Self-contained CSS-in-JS styles for SDK components.
 * Uses CSS custom properties for theming.
 */

import type { CSSProperties } from 'react'

// ============================================
// Theme Variables
// ============================================

export interface ThemeVariables {
	// Colors
	colorPrimary: string
	colorPrimaryForeground: string
	colorBackground: string
	colorForeground: string
	colorMuted: string
	colorMutedForeground: string
	colorBorder: string
	colorInput: string
	colorInputBackground: string
	colorRing: string
	colorDestructive: string
	colorDestructiveForeground: string
	colorSuccess: string
	colorSuccessForeground: string
	colorWarning: string
	colorWarningForeground: string

	// Typography
	fontFamily: string
	fontSizeXs: string
	fontSizeSm: string
	fontSizeBase: string
	fontSizeLg: string
	fontSizeXl: string
	fontSizeXxl: string

	// Spacing & Borders
	borderRadius: string
	borderRadiusSm: string
	borderRadiusLg: string
	spacingUnit: string
}

export const defaultTheme: ThemeVariables = {
	// Colors - Light theme
	colorPrimary: '#0ea5e9',
	colorPrimaryForeground: '#ffffff',
	colorBackground: '#ffffff',
	colorForeground: '#0f172a',
	colorMuted: '#f1f5f9',
	colorMutedForeground: '#64748b',
	colorBorder: '#e2e8f0',
	colorInput: '#e2e8f0',
	colorInputBackground: '#ffffff',
	colorRing: '#0ea5e9',
	colorDestructive: '#ef4444',
	colorDestructiveForeground: '#ffffff',
	colorSuccess: '#22c55e',
	colorSuccessForeground: '#ffffff',
	colorWarning: '#f59e0b',
	colorWarningForeground: '#ffffff',

	// Typography
	fontFamily:
		'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
	fontSizeXs: '0.75rem',
	fontSizeSm: '0.875rem',
	fontSizeBase: '1rem',
	fontSizeLg: '1.125rem',
	fontSizeXl: '1.25rem',
	fontSizeXxl: '1.5rem',

	// Spacing & Borders
	borderRadius: '0.5rem',
	borderRadiusSm: '0.375rem',
	borderRadiusLg: '0.75rem',
	spacingUnit: '0.25rem',
}

export const darkTheme: Partial<ThemeVariables> = {
	colorBackground: '#0f172a',
	colorForeground: '#f8fafc',
	colorMuted: '#1e293b',
	colorMutedForeground: '#94a3b8',
	colorBorder: '#334155',
	colorInput: '#334155',
	colorInputBackground: '#1e293b',
}

// ============================================
// Style Utilities
// ============================================

type StyleFunction = (theme: ThemeVariables) => CSSProperties

/**
 * Create themed styles
 */
export function createStyles<T extends Record<string, StyleFunction | CSSProperties>>(
	stylesFn: (theme: ThemeVariables) => T
): (theme: ThemeVariables) => { [K in keyof T]: CSSProperties } {
	return (theme: ThemeVariables) => {
		const styles = stylesFn(theme)
		const result: Record<string, CSSProperties> = {}

		for (const [key, value] of Object.entries(styles)) {
			if (typeof value === 'function') {
				result[key] = value(theme)
			} else {
				result[key] = value
			}
		}

		return result as { [K in keyof T]: CSSProperties }
	}
}

/**
 * Merge multiple style objects
 */
export function mergeStyles(...styles: (CSSProperties | undefined)[]): CSSProperties {
	return Object.assign({}, ...styles.filter(Boolean))
}

/**
 * Conditional styles
 */
export function conditionalStyle(
	condition: boolean,
	trueStyle: CSSProperties,
	falseStyle?: CSSProperties
): CSSProperties {
	return condition ? trueStyle : (falseStyle ?? {})
}

// ============================================
// Base Component Styles
// ============================================

export const baseStyles = createStyles((theme) => ({
	// Container
	container: {
		fontFamily: theme.fontFamily,
		fontSize: theme.fontSizeBase,
		color: theme.colorForeground,
		backgroundColor: theme.colorBackground,
		lineHeight: 1.5,
		boxSizing: 'border-box',
	},

	// Card
	card: {
		backgroundColor: theme.colorBackground,
		borderRadius: theme.borderRadiusLg,
		border: `1px solid ${theme.colorBorder}`,
		boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
		overflow: 'hidden',
	},

	cardHeader: {
		padding: '1.5rem',
		paddingBottom: '0',
	},

	cardContent: {
		padding: '1.5rem',
	},

	cardTitle: {
		fontSize: theme.fontSizeXl,
		fontWeight: 600,
		margin: 0,
		marginBottom: '0.25rem',
	},

	cardDescription: {
		fontSize: theme.fontSizeSm,
		color: theme.colorMutedForeground,
		margin: 0,
	},

	// Form Elements
	formGroup: {
		marginBottom: '1rem',
	},

	label: {
		display: 'block',
		fontSize: theme.fontSizeSm,
		fontWeight: 500,
		marginBottom: '0.5rem',
		color: theme.colorForeground,
	},

	input: {
		width: '100%',
		padding: '0.5rem 0.75rem',
		fontSize: theme.fontSizeBase,
		lineHeight: 1.5,
		color: theme.colorForeground,
		backgroundColor: theme.colorInputBackground,
		border: `1px solid ${theme.colorInput}`,
		borderRadius: theme.borderRadius,
		outline: 'none',
		transition: 'border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out',
		boxSizing: 'border-box',
	},

	inputFocus: {
		borderColor: theme.colorRing,
		boxShadow: `0 0 0 3px ${theme.colorRing}33`,
	},

	inputError: {
		borderColor: theme.colorDestructive,
	},

	inputDisabled: {
		backgroundColor: theme.colorMuted,
		cursor: 'not-allowed',
		opacity: 0.7,
	},

	// Buttons
	button: {
		display: 'inline-flex',
		alignItems: 'center',
		justifyContent: 'center',
		gap: '0.5rem',
		padding: '0.5rem 1rem',
		fontSize: theme.fontSizeSm,
		fontWeight: 500,
		lineHeight: 1.5,
		borderRadius: theme.borderRadius,
		border: 'none',
		cursor: 'pointer',
		transition: 'all 0.15s ease-in-out',
		textDecoration: 'none',
		whiteSpace: 'nowrap',
	},

	buttonPrimary: {
		backgroundColor: theme.colorPrimary,
		color: theme.colorPrimaryForeground,
	},

	buttonPrimaryHover: {
		backgroundColor: theme.colorPrimary,
		filter: 'brightness(1.1)',
	},

	buttonSecondary: {
		backgroundColor: theme.colorMuted,
		color: theme.colorForeground,
	},

	buttonOutline: {
		backgroundColor: 'transparent',
		border: `1px solid ${theme.colorBorder}`,
		color: theme.colorForeground,
	},

	buttonGhost: {
		backgroundColor: 'transparent',
		color: theme.colorForeground,
	},

	buttonDestructive: {
		backgroundColor: theme.colorDestructive,
		color: theme.colorDestructiveForeground,
	},

	buttonDisabled: {
		opacity: 0.5,
		cursor: 'not-allowed',
	},

	buttonFullWidth: {
		width: '100%',
	},

	// Links
	link: {
		color: theme.colorPrimary,
		textDecoration: 'none',
		cursor: 'pointer',
	},

	linkHover: {
		textDecoration: 'underline',
	},

	// Alerts
	alert: {
		padding: '0.75rem 1rem',
		borderRadius: theme.borderRadius,
		fontSize: theme.fontSizeSm,
		marginBottom: '1rem',
	},

	alertError: {
		backgroundColor: `${theme.colorDestructive}15`,
		color: theme.colorDestructive,
		border: `1px solid ${theme.colorDestructive}30`,
	},

	alertSuccess: {
		backgroundColor: `${theme.colorSuccess}15`,
		color: theme.colorSuccess,
		border: `1px solid ${theme.colorSuccess}30`,
	},

	alertWarning: {
		backgroundColor: `${theme.colorWarning}15`,
		color: theme.colorWarning,
		border: `1px solid ${theme.colorWarning}30`,
	},

	// Divider
	divider: {
		display: 'flex',
		alignItems: 'center',
		margin: '1.5rem 0',
	},

	dividerLine: {
		flex: 1,
		height: '1px',
		backgroundColor: theme.colorBorder,
	},

	dividerText: {
		padding: '0 1rem',
		fontSize: theme.fontSizeXs,
		color: theme.colorMutedForeground,
		textTransform: 'uppercase',
		letterSpacing: '0.05em',
	},

	// Tabs
	tabs: {
		display: 'flex',
		backgroundColor: theme.colorMuted,
		padding: '0.25rem',
		borderRadius: theme.borderRadius,
		marginBottom: '1.5rem',
	},

	tab: {
		flex: 1,
		padding: '0.5rem 0.75rem',
		fontSize: theme.fontSizeSm,
		fontWeight: 500,
		color: theme.colorMutedForeground,
		backgroundColor: 'transparent',
		border: 'none',
		borderRadius: theme.borderRadiusSm,
		cursor: 'pointer',
		transition: 'all 0.15s ease-in-out',
	},

	tabActive: {
		backgroundColor: theme.colorBackground,
		color: theme.colorForeground,
		boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
	},

	// Badge
	badge: {
		display: 'inline-flex',
		alignItems: 'center',
		padding: '0.125rem 0.5rem',
		fontSize: theme.fontSizeXs,
		fontWeight: 500,
		borderRadius: '9999px',
	},

	badgePrimary: {
		backgroundColor: `${theme.colorPrimary}15`,
		color: theme.colorPrimary,
	},

	badgeSuccess: {
		backgroundColor: `${theme.colorSuccess}15`,
		color: theme.colorSuccess,
	},

	badgeWarning: {
		backgroundColor: `${theme.colorWarning}15`,
		color: theme.colorWarning,
	},

	badgeDestructive: {
		backgroundColor: `${theme.colorDestructive}15`,
		color: theme.colorDestructive,
	},

	// Spinner
	spinner: {
		width: '1rem',
		height: '1rem',
		border: '2px solid transparent',
		borderTopColor: 'currentColor',
		borderRadius: '50%',
		animation: 'sylphx-spin 0.75s linear infinite',
	},

	// Text utilities
	textMuted: {
		color: theme.colorMutedForeground,
	},

	textCenter: {
		textAlign: 'center',
	},

	textSm: {
		fontSize: theme.fontSizeSm,
	},

	textXs: {
		fontSize: theme.fontSizeXs,
	},

	// Spacing utilities
	mt1: { marginTop: '0.25rem' },
	mt2: { marginTop: '0.5rem' },
	mt4: { marginTop: '1rem' },
	mt6: { marginTop: '1.5rem' },
	mb1: { marginBottom: '0.25rem' },
	mb2: { marginBottom: '0.5rem' },
	mb4: { marginBottom: '1rem' },
	mb6: { marginBottom: '1.5rem' },

	// Flexbox utilities
	flexRow: {
		display: 'flex',
		flexDirection: 'row',
	},

	flexCol: {
		display: 'flex',
		flexDirection: 'column',
	},

	flexCenter: {
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
	},

	flexBetween: {
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'space-between',
	},

	gap1: { gap: '0.25rem' },
	gap2: { gap: '0.5rem' },
	gap3: { gap: '0.75rem' },
	gap4: { gap: '1rem' },

	// Grid
	grid: {
		display: 'grid',
	},

	gridCols2: {
		gridTemplateColumns: 'repeat(2, 1fr)',
	},
}))

// ============================================
// CSS Keyframes (injected once)
// ============================================

let stylesInjected = false

export function injectGlobalStyles(): void {
	if (stylesInjected || typeof document === 'undefined') return

	const style = document.createElement('style')
	style.id = 'sylphx-sdk-styles'
	style.textContent = `
    @keyframes sylphx-spin {
      to { transform: rotate(360deg); }
    }

    @keyframes sylphx-fade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes sylphx-slide-up {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes sylphx-scale-in {
      from {
        opacity: 0;
        transform: scale(0.95);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }

    .sylphx-focus-visible:focus-visible {
      outline: 2px solid var(--sylphx-ring);
      outline-offset: 2px;
    }
  `
	document.head.appendChild(style)
	stylesInjected = true
}
