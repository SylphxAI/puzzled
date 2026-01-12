'use client'

import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Component, type ReactNode } from 'react'
import { captureError } from '@/lib/monitoring'
import { Button } from '@sylphx/ui'

type ErrorBoundaryProps = {
	children: ReactNode
	fallback?: ReactNode
	onReset?: () => void
}

type ErrorBoundaryState = {
	hasError: boolean
	error?: Error
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
	constructor(props: ErrorBoundaryProps) {
		super(props)
		this.state = { hasError: false }
	}

	static getDerivedStateFromError(error: Error): ErrorBoundaryState {
		return { hasError: true, error }
	}

	componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
		// Log locally for development
		console.error('Error caught by boundary:', error, errorInfo)

		// Report to platform monitoring with component stack context
		captureError(error, {
			tags: { errorBoundary: 'component' },
			extra: {
				componentStack: errorInfo.componentStack,
			},
			level: 'error',
		})
	}

	handleReset = () => {
		this.setState({ hasError: false, error: undefined })
		this.props.onReset?.()
	}

	render() {
		if (this.state.hasError) {
			if (this.props.fallback) {
				return this.props.fallback
			}

			return <ErrorFallback error={this.state.error} onReset={this.handleReset} />
		}

		return this.props.children
	}
}

// Default error fallback UI
export function ErrorFallback({
	error,
	onReset,
	title = 'Something went wrong',
	description = "We're sorry, but something unexpected happened. Please try again.",
}: {
	error?: Error
	onReset?: () => void
	title?: string
	description?: string
}) {
	return (
		<div className="flex min-h-[300px] flex-col items-center justify-center p-6 text-center">
			<div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--toast-error-bg)]">
				<AlertTriangle className="h-8 w-8 text-[var(--color-error)]" />
			</div>
			<h2 className="text-lg font-semibold">{title}</h2>
			<p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
			{error && process.env.NODE_ENV === 'development' && (
				<pre className="mt-4 max-w-md overflow-auto rounded-lg bg-muted p-4 text-left text-xs">
					{error.message}
				</pre>
			)}
			{onReset && (
				<Button onClick={onReset} className="mt-4 gap-2">
					<RefreshCw className="h-4 w-4" />
					Try Again
				</Button>
			)}
		</div>
	)
}

// Inline error for smaller components
export function InlineError({ message, onRetry }: { message: string; onRetry?: () => void }) {
	return (
		<div className="flex items-center gap-2 rounded-lg bg-[var(--toast-error-bg)] border border-[var(--toast-error-border)] p-3 text-sm text-[var(--toast-error-text)]">
			<AlertTriangle className="h-4 w-4 shrink-0" />
			<span className="flex-1">{message}</span>
			{onRetry && (
				<button
					type="button"
					onClick={onRetry}
					className="shrink-0 font-medium underline hover:no-underline"
				>
					Retry
				</button>
			)}
		</div>
	)
}
