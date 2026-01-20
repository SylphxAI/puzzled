/**
 * Error Boundary Components
 *
 * Pre-built error boundary with automatic error reporting.
 * Includes fallback UI and user feedback collection.
 */

'use client'

import {
	Component,
	type ReactNode,
	type ErrorInfo,
	useState,
	useEffect,
	type CSSProperties,
} from 'react'
import type { ThemeVariables } from './styles'
import { defaultTheme, baseStyles, mergeStyles, injectGlobalStyles } from './styles'
import { useErrorTracking, useErrorBoundary as useErrorBoundaryHook } from '../monitoring-hooks'

// ============================================
// SylphxErrorBoundary (Class Component)
// ============================================

export interface ErrorBoundaryFallbackProps {
	error: Error
	errorInfo?: ErrorInfo
	eventId: string | null
	resetError: () => void
	theme: ThemeVariables
}

export interface SylphxErrorBoundaryProps {
	/** Child components */
	children: ReactNode
	/** Theme variables */
	theme?: ThemeVariables
	/** Custom fallback component */
	fallback?: ReactNode | ((props: ErrorBoundaryFallbackProps) => ReactNode)
	/** Called when error is caught */
	onError?: (error: Error, errorInfo: ErrorInfo, eventId: string | null) => void
	/** Called when error is reset */
	onReset?: () => void
	/** Component name for context */
	componentName?: string
	/** Show detailed error info in development */
	showDetails?: boolean
}

interface ErrorBoundaryState {
	hasError: boolean
	error: Error | null
	errorInfo: ErrorInfo | null
	eventId: string | null
}

/**
 * Error Boundary with automatic error reporting
 *
 * @example
 * ```tsx
 * <SylphxErrorBoundary
 *   componentName="Dashboard"
 *   onError={(error, info, eventId) => {
 *     console.log('Error captured:', eventId)
 *   }}
 * >
 *   <Dashboard />
 * </SylphxErrorBoundary>
 *
 * // With custom fallback
 * <SylphxErrorBoundary
 *   fallback={({ error, resetError }) => (
 *     <div>
 *       <p>Something went wrong: {error.message}</p>
 *       <button onClick={resetError}>Try again</button>
 *     </div>
 *   )}
 * >
 *   <App />
 * </SylphxErrorBoundary>
 * ```
 */
export class SylphxErrorBoundary extends Component<SylphxErrorBoundaryProps, ErrorBoundaryState> {
	constructor(props: SylphxErrorBoundaryProps) {
		super(props)
		this.state = {
			hasError: false,
			error: null,
			errorInfo: null,
			eventId: null,
		}
	}

	static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
		return { hasError: true, error }
	}

	componentDidCatch(error: Error, errorInfo: ErrorInfo) {
		this.setState({ errorInfo })

		// Report error using the context wrapper
		// This will be handled by ErrorBoundaryContextWrapper
		this.props.onError?.(error, errorInfo, null)
	}

	resetError = () => {
		this.setState({
			hasError: false,
			error: null,
			errorInfo: null,
			eventId: null,
		})
		this.props.onReset?.()
	}

	render() {
		const { hasError, error, errorInfo, eventId } = this.state
		const { children, fallback, theme = defaultTheme, showDetails } = this.props

		if (hasError && error) {
			// Custom fallback
			if (fallback) {
				if (typeof fallback === 'function') {
					return fallback({
						error,
						errorInfo: errorInfo || undefined,
						eventId,
						resetError: this.resetError,
						theme,
					})
				}
				return fallback
			}

			// Default fallback
			return (
				<DefaultErrorFallback
					error={error}
					errorInfo={errorInfo || undefined}
					eventId={eventId}
					resetError={this.resetError}
					theme={theme}
					showDetails={showDetails}
				/>
			)
		}

		return children
	}
}

// ============================================
// ErrorBoundary with Context (Functional Wrapper)
// ============================================

export interface ErrorBoundaryProps extends Omit<SylphxErrorBoundaryProps, 'onError'> {
	/** Called when error is caught (with eventId) */
	onError?: (error: Error, errorInfo: ErrorInfo, eventId: string | null) => void
}

/**
 * Error Boundary that automatically reports to Sylphx Platform
 *
 * @example
 * ```tsx
 * // In your app root
 * <SylphxProvider>
 *   <ErrorBoundary>
 *     <App />
 *   </ErrorBoundary>
 * </SylphxProvider>
 * ```
 */
export function ErrorBoundary(props: ErrorBoundaryProps) {
	const { handleError } = useErrorBoundaryHook({
		componentName: props.componentName,
		onError: (error, eventId) => {
			// Get errorInfo from state if available
			props.onError?.(error, {} as ErrorInfo, eventId)
		},
	})

	return (
		<SylphxErrorBoundary
			{...props}
			onError={(error, errorInfo, _eventId) => {
				// Use the hook's handleError which reports to platform
				handleError(error, { componentStack: errorInfo.componentStack ?? undefined })
			}}
		/>
	)
}

// ============================================
// Default Error Fallback
// ============================================

interface DefaultErrorFallbackProps {
	error: Error
	errorInfo?: ErrorInfo
	eventId: string | null
	resetError: () => void
	theme: ThemeVariables
	showDetails?: boolean
}

function DefaultErrorFallback({
	error,
	errorInfo,
	eventId,
	resetError,
	theme,
	showDetails = process.env.NODE_ENV === 'development',
}: DefaultErrorFallbackProps) {
	const styles = baseStyles(theme)

	useEffect(() => {
		injectGlobalStyles()
	}, [])

	const containerStyle: CSSProperties = mergeStyles(styles.container, {
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		minHeight: '300px',
		padding: '2rem',
	})

	const cardStyle: CSSProperties = mergeStyles(styles.card, {
		maxWidth: '500px',
		width: '100%',
		padding: '2rem',
		textAlign: 'center',
	})

	return (
		<div style={containerStyle}>
			<div style={cardStyle}>
				<div
					style={{
						width: '64px',
						height: '64px',
						borderRadius: '50%',
						backgroundColor: `${theme.colorDestructive}15`,
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						margin: '0 auto 1.5rem',
					}}
				>
					<ErrorIcon color={theme.colorDestructive} />
				</div>

				<h2 style={{ margin: '0 0 0.5rem', fontSize: theme.fontSizeXl, fontWeight: 600 }}>
					Something went wrong
				</h2>
				<p style={mergeStyles(styles.textSm, styles.textMuted, { marginBottom: '1.5rem' })}>
					We've been notified and are working to fix the issue.
				</p>

				{eventId && (
					<p style={mergeStyles(styles.textXs, styles.textMuted, { marginBottom: '1.5rem' })}>
						Error ID: <code style={{ fontFamily: 'monospace' }}>{eventId}</code>
					</p>
				)}

				{showDetails && (
					<div
						style={{
							textAlign: 'left',
							padding: '1rem',
							backgroundColor: theme.colorMuted,
							borderRadius: theme.borderRadius,
							marginBottom: '1.5rem',
							overflow: 'auto',
							maxHeight: '200px',
						}}
					>
						<p
							style={{
								margin: '0 0 0.5rem',
								fontSize: theme.fontSizeXs,
								fontWeight: 600,
								color: theme.colorDestructive,
							}}
						>
							{error.name}: {error.message}
						</p>
						{errorInfo?.componentStack && (
							<pre
								style={{
									margin: 0,
									fontSize: '10px',
									color: theme.colorMutedForeground,
									whiteSpace: 'pre-wrap',
									wordBreak: 'break-word',
								}}
							>
								{errorInfo.componentStack}
							</pre>
						)}
					</div>
				)}

				<div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
					<button
						type="button"
						onClick={() => window.location.reload()}
						style={mergeStyles(styles.button, styles.buttonOutline)}
					>
						Refresh Page
					</button>
					<button type="button" onClick={resetError} style={mergeStyles(styles.button, styles.buttonPrimary)}>
						Try Again
					</button>
				</div>
			</div>
		</div>
	)
}

// ============================================
// FeedbackWidget
// ============================================

export interface FeedbackWidgetProps {
	/** Theme variables */
	theme?: ThemeVariables
	/** Widget title */
	title?: string
	/** Widget description */
	description?: string
	/** Placeholder text */
	placeholder?: string
	/** Submit button text */
	submitText?: string
	/** Success message */
	successMessage?: string
	/** Called when feedback is submitted */
	onSubmit?: (feedback: { message: string; email?: string; eventId?: string }) => Promise<void>
	/** Associated error event ID */
	eventId?: string
	/** Custom class name */
	className?: string
	/** Show email field */
	showEmail?: boolean
	/** Position */
	position?: 'bottom-right' | 'bottom-left'
	/** Initially open */
	defaultOpen?: boolean
}

/**
 * Feedback widget for collecting user feedback
 *
 * @example
 * ```tsx
 * // Floating feedback button
 * <FeedbackWidget
 *   position="bottom-right"
 *   onSubmit={async (feedback) => {
 *     await reportFeedback(feedback)
 *   }}
 * />
 *
 * // After error, collect context
 * <FeedbackWidget
 *   eventId={errorEventId}
 *   title="Help us fix this"
 *   description="What were you trying to do when this error occurred?"
 * />
 * ```
 */
export function FeedbackWidget({
	theme = defaultTheme,
	title = 'Send Feedback',
	description = 'Help us improve by sharing your thoughts.',
	placeholder = 'Describe your issue or suggestion...',
	submitText = 'Submit',
	successMessage = 'Thank you for your feedback!',
	onSubmit,
	eventId,
	className,
	showEmail = true,
	position = 'bottom-right',
	defaultOpen = false,
}: FeedbackWidgetProps) {
	const [isOpen, setIsOpen] = useState(defaultOpen)
	const [message, setMessage] = useState('')
	const [email, setEmail] = useState('')
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [isSuccess, setIsSuccess] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const { captureMessage } = useErrorTracking()
	const styles = baseStyles(theme)

	useEffect(() => {
		injectGlobalStyles()
	}, [])

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!message.trim()) return

		setIsSubmitting(true)
		setError(null)

		try {
			// Report to Sylphx Platform
			await captureMessage(`User Feedback: ${message}`, {
				level: 'info',
				tags: { type: 'feedback' },
				extra: { email, eventId },
			})

			// Call custom handler
			await onSubmit?.({ message, email: showEmail ? email : undefined, eventId })

			setIsSuccess(true)
			setMessage('')
			setEmail('')

			// Auto-close after success
			setTimeout(() => {
				setIsOpen(false)
				setIsSuccess(false)
			}, 3000)
		} catch (err) {
			setError('Failed to submit feedback. Please try again.')
		} finally {
			setIsSubmitting(false)
		}
	}

	const positionStyles: Record<string, CSSProperties> = {
		'bottom-right': { bottom: '1rem', right: '1rem' },
		'bottom-left': { bottom: '1rem', left: '1rem' },
	}

	const containerStyle: CSSProperties = {
		position: 'fixed',
		zIndex: 9999,
		fontFamily: theme.fontFamily,
		...positionStyles[position],
	}

	const buttonStyle: CSSProperties = mergeStyles(styles.button, styles.buttonPrimary, {
		padding: '0.75rem 1rem',
		borderRadius: '9999px',
		boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
	})

	const panelStyle: CSSProperties = mergeStyles(styles.card, {
		width: '320px',
		animation: 'sylphx-scale-in 0.2s ease',
	})

	if (!isOpen) {
		return (
			<div style={containerStyle} className={className}>
				<button type="button" onClick={() => setIsOpen(true)} style={buttonStyle}>
					<FeedbackIcon />
					Feedback
				</button>
			</div>
		)
	}

	return (
		<div style={containerStyle} className={className}>
			<div style={panelStyle}>
				{/* Header */}
				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'space-between',
						padding: '1rem',
						borderBottom: `1px solid ${theme.colorBorder}`,
					}}
				>
					<h3 style={{ margin: 0, fontSize: theme.fontSizeSm, fontWeight: 600 }}>{title}</h3>
					<button
						type="button"
						onClick={() => setIsOpen(false)}
						style={mergeStyles(styles.button, styles.buttonGhost, { padding: '0.25rem' })}
					>
						<CloseIcon />
					</button>
				</div>

				{/* Content */}
				<div style={{ padding: '1rem' }}>
					{isSuccess ? (
						<div style={{ textAlign: 'center', padding: '1rem 0' }}>
							<CheckCircleIcon color={theme.colorSuccess} />
							<p style={mergeStyles(styles.textSm, { marginTop: '0.5rem' })}>{successMessage}</p>
						</div>
					) : (
						<form onSubmit={handleSubmit}>
							<p style={mergeStyles(styles.textXs, styles.textMuted, { marginBottom: '1rem' })}>
								{description}
							</p>

							{error && (
								<div style={mergeStyles(styles.alert, styles.alertError, { marginBottom: '1rem' })}>
									{error}
								</div>
							)}

							<div style={styles.formGroup}>
								<textarea
									value={message}
									onChange={(e) => setMessage(e.target.value)}
									placeholder={placeholder}
									rows={4}
									style={mergeStyles(styles.input, { resize: 'vertical', minHeight: '80px' })}
									required
								/>
							</div>

							{showEmail && (
								<div style={styles.formGroup}>
									<input
										type="email"
										value={email}
										onChange={(e) => setEmail(e.target.value)}
										placeholder="Email (optional)"
										style={styles.input}
									/>
								</div>
							)}

							{eventId && (
								<p style={mergeStyles(styles.textXs, styles.textMuted, { marginBottom: '1rem' })}>
									Error ID: <code>{eventId}</code>
								</p>
							)}

							<button
								type="submit"
								disabled={isSubmitting || !message.trim()}
								style={mergeStyles(
									styles.button,
									styles.buttonPrimary,
									styles.buttonFullWidth,
									(isSubmitting || !message.trim()) ? styles.buttonDisabled : undefined
								)}
							>
								{isSubmitting ? <span style={styles.spinner} /> : submitText}
							</button>
						</form>
					)}
				</div>
			</div>
		</div>
	)
}

// ============================================
// Icons
// ============================================

function ErrorIcon({ color }: { color: string }) {
	return (
		<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
			<circle cx="12" cy="12" r="10" />
			<line x1="12" y1="8" x2="12" y2="12" />
			<line x1="12" y1="16" x2="12.01" y2="16" />
		</svg>
	)
}

function FeedbackIcon() {
	return (
		<svg
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			style={{ marginRight: '0.5rem' }}
		>
			<path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
		</svg>
	)
}

function CloseIcon() {
	return (
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
			<line x1="18" y1="6" x2="6" y2="18" />
			<line x1="6" y1="6" x2="18" y2="18" />
		</svg>
	)
}

function CheckCircleIcon({ color }: { color: string }) {
	return (
		<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
			<path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
			<polyline points="22 4 12 14.01 9 11.01" />
		</svg>
	)
}
