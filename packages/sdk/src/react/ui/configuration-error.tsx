/**
 * Configuration Error Component
 *
 * Environment-aware error display when SDK is not configured.
 * - Development: Shows helpful setup instructions with step-by-step guide
 * - Production: Shows generic user-friendly message
 *
 * Design inspired by Clerk and other best-in-class auth providers.
 */

'use client'

import { useState, type CSSProperties } from 'react'
import { type ThemeVariables, defaultTheme } from './styles'

export type ConfigurationComponentType =
	| 'sign-in'
	| 'sign-up'
	| 'user-button'
	| 'user'
	| 'account'
	| 'auth'
	| 'billing'
	| 'storage'
	| 'analytics'
	| 'organization'
	| 'notifications'
	| 'protect'
	| 'referral'
	| 'general'

export interface ConfigurationErrorProps {
	/** Theme variables */
	theme?: ThemeVariables
	/** Component type for contextual messaging */
	componentType?: ConfigurationComponentType
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

const ENV_VARS_CODE = `NEXT_PUBLIC_SYLPHX_APP_ID="your-app-id"
NEXT_PUBLIC_SYLPHX_PUBLISHABLE_KEY="pk_xxx"`

/**
 * Development-only setup card with helpful instructions
 */
function DeveloperSetupCard({ theme }: { theme: ThemeVariables }) {
	const [copied, setCopied] = useState(false)

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(ENV_VARS_CODE)
			setCopied(true)
			setTimeout(() => setCopied(false), 2000)
		} catch {
			// Fallback for older browsers
			const textarea = document.createElement('textarea')
			textarea.value = ENV_VARS_CODE
			document.body.appendChild(textarea)
			textarea.select()
			document.execCommand('copy')
			document.body.removeChild(textarea)
			setCopied(true)
			setTimeout(() => setCopied(false), 2000)
		}
	}

	return (
		<div style={styles.devCard}>
			{/* Header with icon */}
			<div style={styles.devHeader}>
				<div style={styles.iconContainer}>
					<ToolIcon />
				</div>
				<div>
					<h3 style={styles.devTitle}>SDK Configuration Required</h3>
					<p style={styles.devSubtitle}>Complete setup to enable authentication</p>
				</div>
			</div>

			{/* Steps */}
			<div style={styles.stepsContainer}>
				{/* Step 1 */}
				<div style={styles.step}>
					<div style={styles.stepNumber}>1</div>
					<div style={styles.stepContent}>
						<p style={styles.stepTitle}>Get your API keys</p>
						<p style={styles.stepDescription}>
							Visit the{' '}
							<a
								href="https://sylphx.com/console"
								target="_blank"
								rel="noopener noreferrer"
								style={styles.link}
							>
								Sylphx Console
							</a>{' '}
							to create an app and get your keys.
						</p>
					</div>
				</div>

				{/* Step 2 */}
				<div style={styles.step}>
					<div style={styles.stepNumber}>2</div>
					<div style={styles.stepContent}>
						<p style={styles.stepTitle}>
							Add to <code style={styles.inlineCode}>.env.local</code>
						</p>
						<div style={styles.codeBlock}>
							<pre style={styles.codeContent}>{ENV_VARS_CODE}</pre>
							<button
								type="button"
								style={styles.copyButton}
								onClick={handleCopy}
								title={copied ? 'Copied!' : 'Copy to clipboard'}
							>
								{copied ? <CheckIcon /> : <CopyIcon />}
							</button>
						</div>
					</div>
				</div>

				{/* Step 3 */}
				<div style={styles.step}>
					<div style={styles.stepNumber}>3</div>
					<div style={styles.stepContent}>
						<p style={styles.stepTitle}>Restart your dev server</p>
						<p style={styles.stepDescription}>
							Run <code style={styles.inlineCode}>npm run dev</code> or restart your server to load the new
							environment variables.
						</p>
					</div>
				</div>
			</div>

			{/* Footer */}
			<div style={styles.devFooter}>
				<a
					href="https://sylphx.com/docs/sdk/getting-started"
					target="_blank"
					rel="noopener noreferrer"
					style={styles.docsButton}
				>
					<BookIcon />
					Read the docs
				</a>
				<p style={styles.devNote}>This message only appears in development mode.</p>
			</div>
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
	componentType: ConfigurationComponentType
	onRetry?: () => void
}) {
	const getMessage = () => {
		switch (componentType) {
			case 'sign-in':
				return 'Sign in is temporarily unavailable.'
			case 'sign-up':
				return 'Sign up is temporarily unavailable.'
			case 'billing':
				return 'Billing is temporarily unavailable.'
			case 'storage':
				return 'File upload is temporarily unavailable.'
			case 'organization':
				return 'Organization features are temporarily unavailable.'
			case 'notifications':
				return 'Notifications are temporarily unavailable.'
			default:
				return 'This feature is temporarily unavailable.'
		}
	}

	return (
		<div
			style={{
				...styles.prodCard,
				backgroundColor: theme.colorBackground,
				border: `1px solid ${theme.colorBorder}`,
				fontFamily: theme.fontFamily,
			}}
		>
			<div style={styles.prodIcon}>
				<AlertIcon color={theme.colorWarning} />
			</div>

			<h3
				style={{
					...styles.prodTitle,
					color: theme.colorForeground,
					fontSize: theme.fontSizeLg,
				}}
			>
				{getMessage()}
			</h3>

			<p
				style={{
					...styles.prodDescription,
					color: theme.colorMutedForeground,
					fontSize: theme.fontSizeSm,
				}}
			>
				Please try again later or contact support if the problem persists.
			</p>

			{onRetry && (
				<button
					type="button"
					onClick={onRetry}
					style={{
						...styles.retryButton,
						border: `1px solid ${theme.colorBorder}`,
						backgroundColor: theme.colorBackground,
						color: theme.colorForeground,
						fontSize: theme.fontSizeSm,
						borderRadius: theme.borderRadiusSm,
					}}
				>
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

// ============================================
// Icons
// ============================================

function ToolIcon() {
	return (
		<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
			<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
		</svg>
	)
}

function CopyIcon() {
	return (
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
			<rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
			<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
		</svg>
	)
}

function CheckIcon() {
	return (
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
			<polyline points="20 6 9 17 4 12" />
		</svg>
	)
}

function BookIcon() {
	return (
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
			<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
			<path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
		</svg>
	)
}

function AlertIcon({ color }: { color: string }) {
	return (
		<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
			<circle cx="12" cy="12" r="10" />
			<line x1="12" y1="8" x2="12" y2="12" />
			<line x1="12" y1="16" x2="12.01" y2="16" />
		</svg>
	)
}

// ============================================
// Styles
// ============================================

const styles: Record<string, CSSProperties> = {
	// Development card styles
	devCard: {
		maxWidth: '420px',
		margin: '0 auto',
		padding: '1.5rem',
		backgroundColor: '#fffbeb', // amber-50
		border: '1px solid #fcd34d', // amber-300
		borderRadius: '12px',
		fontFamily:
			'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
		boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
	},
	devHeader: {
		display: 'flex',
		alignItems: 'flex-start',
		gap: '0.75rem',
		marginBottom: '1.25rem',
	},
	iconContainer: {
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		width: '40px',
		height: '40px',
		borderRadius: '10px',
		backgroundColor: '#fef3c7', // amber-100
		color: '#d97706', // amber-600
		flexShrink: 0,
	},
	devTitle: {
		margin: 0,
		fontSize: '1rem',
		fontWeight: 600,
		color: '#78350f', // amber-900
		lineHeight: 1.4,
	},
	devSubtitle: {
		margin: '0.125rem 0 0',
		fontSize: '0.8125rem',
		color: '#92400e', // amber-800
		lineHeight: 1.4,
	},
	stepsContainer: {
		display: 'flex',
		flexDirection: 'column',
		gap: '1rem',
	},
	step: {
		display: 'flex',
		gap: '0.75rem',
	},
	stepNumber: {
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		width: '24px',
		height: '24px',
		borderRadius: '50%',
		backgroundColor: '#d97706', // amber-600
		color: '#fff',
		fontSize: '0.75rem',
		fontWeight: 600,
		flexShrink: 0,
	},
	stepContent: {
		flex: 1,
		minWidth: 0,
	},
	stepTitle: {
		margin: 0,
		fontSize: '0.875rem',
		fontWeight: 500,
		color: '#78350f', // amber-900
		lineHeight: 1.4,
	},
	stepDescription: {
		margin: '0.25rem 0 0',
		fontSize: '0.8125rem',
		color: '#92400e', // amber-800
		lineHeight: 1.5,
	},
	link: {
		color: '#0369a1', // sky-700
		textDecoration: 'none',
		fontWeight: 500,
	},
	inlineCode: {
		backgroundColor: '#fde68a', // amber-200
		padding: '0.125rem 0.375rem',
		borderRadius: '4px',
		fontSize: '0.8125rem',
		fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
	},
	codeBlock: {
		position: 'relative',
		marginTop: '0.5rem',
		backgroundColor: '#1e293b', // slate-800
		borderRadius: '8px',
		overflow: 'hidden',
	},
	codeContent: {
		display: 'block',
		margin: 0,
		padding: '0.875rem 1rem',
		paddingRight: '3rem',
		color: '#e2e8f0', // slate-200
		fontSize: '0.75rem',
		fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
		whiteSpace: 'pre',
		lineHeight: 1.6,
		overflow: 'auto',
	},
	copyButton: {
		position: 'absolute',
		top: '0.5rem',
		right: '0.5rem',
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		width: '28px',
		height: '28px',
		padding: 0,
		background: 'rgba(255, 255, 255, 0.1)',
		border: 'none',
		borderRadius: '6px',
		cursor: 'pointer',
		color: '#94a3b8', // slate-400
		transition: 'background-color 0.15s, color 0.15s',
	},
	devFooter: {
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'space-between',
		marginTop: '1.25rem',
		paddingTop: '1rem',
		borderTop: '1px solid #fcd34d', // amber-300
	},
	docsButton: {
		display: 'inline-flex',
		alignItems: 'center',
		gap: '0.375rem',
		padding: '0.5rem 0.75rem',
		backgroundColor: '#d97706', // amber-600
		color: '#fff',
		fontSize: '0.8125rem',
		fontWeight: 500,
		borderRadius: '6px',
		textDecoration: 'none',
		transition: 'background-color 0.15s',
	},
	devNote: {
		margin: 0,
		fontSize: '0.6875rem',
		color: '#92400e', // amber-800
		fontStyle: 'italic',
	},

	// Production card styles
	prodCard: {
		maxWidth: '400px',
		margin: '0 auto',
		padding: '2rem',
		borderRadius: '12px',
		textAlign: 'center',
	},
	prodIcon: {
		display: 'flex',
		justifyContent: 'center',
		marginBottom: '1rem',
	},
	prodTitle: {
		margin: '0 0 0.5rem 0',
		fontWeight: 600,
	},
	prodDescription: {
		margin: '0 0 1.5rem 0',
		lineHeight: 1.5,
	},
	retryButton: {
		display: 'inline-flex',
		alignItems: 'center',
		justifyContent: 'center',
		padding: '0.625rem 1.25rem',
		fontWeight: 500,
		cursor: 'pointer',
		transition: 'background-color 0.15s, border-color 0.15s',
	},
}
