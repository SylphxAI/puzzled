/**
 * Configuration Error Component
 *
 * Environment-aware error display when SDK is not configured.
 * - Development: Shows helpful setup instructions for developers
 * - Production: Shows generic user-friendly message
 */

'use client'

import type { CSSProperties } from 'react'
import { type ThemeVariables, defaultTheme } from './styles'

export interface ConfigurationErrorProps {
	/** Theme variables */
	theme?: ThemeVariables
	/** Component type for contextual messaging */
	componentType?: 'sign-in' | 'sign-up' | 'user-button' | 'auth'
	/** Custom retry handler */
	onRetry?: () => void
}

/**
 * Detects if we're in a development environment
 */
function isDevelopment(): boolean {
	// Check Next.js / Node environment
	if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
		return true
	}
	// Check for localhost
	if (typeof window !== 'undefined') {
		const hostname = window.location.hostname
		return hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.local')
	}
	return false
}

/**
 * Development-only setup card with helpful instructions
 */
function DeveloperSetupCard({ theme }: { theme: ThemeVariables }) {
	const styles = getStyles(theme)

	return (
		<div style={styles.devCard}>
			<div style={styles.devHeader}>
				<span style={styles.devIcon}>🔧</span>
				<h3 style={styles.devTitle}>SDK Configuration Required</h3>
			</div>

			<p style={styles.devDescription}>
				Add these environment variables to your <code style={styles.code}>.env.local</code> file:
			</p>

			<div style={styles.codeBlock}>
				<code style={styles.codeContent}>
					NEXT_PUBLIC_SYLPHX_APP_ID="your-app-id"
					{'\n'}
					NEXT_PUBLIC_SYLPHX_PUBLISHABLE_KEY="pk_xxx"
				</code>
				<button
					type="button"
					style={styles.copyButton}
					onClick={() => {
						navigator.clipboard.writeText(
							'NEXT_PUBLIC_SYLPHX_APP_ID="your-app-id"\nNEXT_PUBLIC_SYLPHX_PUBLISHABLE_KEY="pk_xxx"'
						)
					}}
					title="Copy to clipboard"
				>
					📋
				</button>
			</div>

			<div style={styles.devFooter}>
				<a
					href="https://sylphx.com/docs/sdk/getting-started"
					target="_blank"
					rel="noopener noreferrer"
					style={styles.docsLink}
				>
					📚 View Setup Guide →
				</a>
				<a
					href="https://sylphx.com/console"
					target="_blank"
					rel="noopener noreferrer"
					style={styles.consoleLink}
				>
					🔑 Get API Keys →
				</a>
			</div>

			<p style={styles.devNote}>
				💡 This message only appears in development mode.
			</p>
		</div>
	)
}

/**
 * Production-friendly error card
 */
function ProductionErrorCard({
	theme,
	componentType,
	onRetry,
}: {
	theme: ThemeVariables
	componentType: string
	onRetry?: () => void
}) {
	const styles = getStyles(theme)

	const getMessage = () => {
		switch (componentType) {
			case 'sign-in':
				return 'Sign in is temporarily unavailable.'
			case 'sign-up':
				return 'Sign up is temporarily unavailable.'
			default:
				return 'Authentication is temporarily unavailable.'
		}
	}

	return (
		<div style={styles.prodCard}>
			<div style={styles.prodIcon}>
				<svg
					width="24"
					height="24"
					viewBox="0 0 24 24"
					fill="none"
					stroke={theme.colorWarning}
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
				>
					<circle cx="12" cy="12" r="10" />
					<line x1="12" y1="8" x2="12" y2="12" />
					<line x1="12" y1="16" x2="12.01" y2="16" />
				</svg>
			</div>

			<h3 style={styles.prodTitle}>{getMessage()}</h3>

			<p style={styles.prodDescription}>
				Please try again later or contact support if the problem persists.
			</p>

			{onRetry && (
				<button type="button" onClick={onRetry} style={styles.retryButton}>
					Try Again
				</button>
			)}
		</div>
	)
}

/**
 * Main ConfigurationError component
 *
 * Shows different UI based on environment:
 * - Development: Helpful setup instructions
 * - Production: Generic user-friendly error
 */
export function ConfigurationError({
	theme = defaultTheme,
	componentType = 'auth',
	onRetry,
}: ConfigurationErrorProps) {
	// Log error for debugging (always)
	if (typeof console !== 'undefined') {
		console.error(
			'[Sylphx SDK] Configuration missing. Please set NEXT_PUBLIC_SYLPHX_APP_ID and NEXT_PUBLIC_SYLPHX_PUBLISHABLE_KEY environment variables.'
		)
	}

	// Development: Show helpful setup card
	if (isDevelopment()) {
		return <DeveloperSetupCard theme={theme} />
	}

	// Production: Show generic error
	return <ProductionErrorCard theme={theme} componentType={componentType} onRetry={onRetry} />
}

/**
 * Get styles based on theme
 */
function getStyles(theme: ThemeVariables): Record<string, CSSProperties> {
	return {
		// Development card styles
		devCard: {
			padding: '1.5rem',
			borderRadius: theme.borderRadius,
			backgroundColor: '#fef3c7', // amber-100
			border: '1px solid #fcd34d', // amber-300
			fontFamily: theme.fontFamily,
			maxWidth: '400px',
			margin: '0 auto',
		},
		devHeader: {
			display: 'flex',
			alignItems: 'center',
			gap: '0.5rem',
			marginBottom: '1rem',
		},
		devIcon: {
			fontSize: '1.5rem',
		},
		devTitle: {
			margin: 0,
			fontSize: theme.fontSizeLg,
			fontWeight: 600,
			color: '#92400e', // amber-800
		},
		devDescription: {
			margin: '0 0 1rem 0',
			fontSize: theme.fontSizeSm,
			color: '#78350f', // amber-900
			lineHeight: 1.5,
		},
		code: {
			backgroundColor: '#fde68a', // amber-200
			padding: '0.125rem 0.375rem',
			borderRadius: '0.25rem',
			fontSize: theme.fontSizeXs,
			fontFamily: 'monospace',
		},
		codeBlock: {
			position: 'relative' as const,
			backgroundColor: '#1e293b', // slate-800
			borderRadius: theme.borderRadiusSm,
			padding: '1rem',
			marginBottom: '1rem',
			overflow: 'auto',
		},
		codeContent: {
			display: 'block',
			color: '#e2e8f0', // slate-200
			fontSize: theme.fontSizeXs,
			fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
			whiteSpace: 'pre',
			lineHeight: 1.6,
		},
		copyButton: {
			position: 'absolute' as const,
			top: '0.5rem',
			right: '0.5rem',
			background: 'transparent',
			border: 'none',
			cursor: 'pointer',
			fontSize: '1rem',
			opacity: 0.7,
			transition: 'opacity 0.2s',
		},
		devFooter: {
			display: 'flex',
			flexDirection: 'column' as const,
			gap: '0.5rem',
			marginBottom: '1rem',
		},
		docsLink: {
			display: 'inline-flex',
			alignItems: 'center',
			gap: '0.25rem',
			color: '#0369a1', // sky-700
			fontSize: theme.fontSizeSm,
			textDecoration: 'none',
			fontWeight: 500,
		},
		consoleLink: {
			display: 'inline-flex',
			alignItems: 'center',
			gap: '0.25rem',
			color: '#0369a1', // sky-700
			fontSize: theme.fontSizeSm,
			textDecoration: 'none',
			fontWeight: 500,
		},
		devNote: {
			margin: 0,
			fontSize: theme.fontSizeXs,
			color: '#92400e', // amber-800
			fontStyle: 'italic',
		},

		// Production card styles
		prodCard: {
			padding: '2rem',
			borderRadius: theme.borderRadius,
			backgroundColor: theme.colorBackground,
			border: `1px solid ${theme.colorBorder}`,
			fontFamily: theme.fontFamily,
			maxWidth: '400px',
			margin: '0 auto',
			textAlign: 'center' as const,
		},
		prodIcon: {
			display: 'flex',
			justifyContent: 'center',
			marginBottom: '1rem',
		},
		prodTitle: {
			margin: '0 0 0.5rem 0',
			fontSize: theme.fontSizeLg,
			fontWeight: 600,
			color: theme.colorForeground,
		},
		prodDescription: {
			margin: '0 0 1.5rem 0',
			fontSize: theme.fontSizeSm,
			color: theme.colorMutedForeground,
			lineHeight: 1.5,
		},
		retryButton: {
			display: 'inline-flex',
			alignItems: 'center',
			justifyContent: 'center',
			padding: '0.625rem 1.25rem',
			fontSize: theme.fontSizeSm,
			fontWeight: 500,
			borderRadius: theme.borderRadiusSm,
			border: `1px solid ${theme.colorBorder}`,
			backgroundColor: theme.colorBackground,
			color: theme.colorForeground,
			cursor: 'pointer',
			transition: 'background-color 0.2s, border-color 0.2s',
		},
	}
}
