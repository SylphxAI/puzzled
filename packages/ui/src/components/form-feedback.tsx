'use client'

import { AlertCircle, CheckCircle2, Info, XCircle } from 'lucide-react'
import { cn } from '../utils'

type FeedbackVariant = 'error' | 'success' | 'warning' | 'info'

type FormFeedbackProps = {
	/** Error message to display */
	error?: string | null
	/** Success message to display */
	success?: string | null
	/** Warning message to display */
	warning?: string | null
	/** Info message to display */
	info?: string | null
	/** Additional CSS classes */
	className?: string
}

const variantConfig: Record<
	FeedbackVariant,
	{
		icon: typeof AlertCircle
		containerClass: string
		textClass: string
	}
> = {
	error: {
		icon: XCircle,
		containerClass: 'bg-[var(--toast-error-bg)] border-[var(--toast-error-border)]',
		textClass: 'text-[var(--toast-error-text)]',
	},
	success: {
		icon: CheckCircle2,
		containerClass: 'bg-[var(--toast-success-bg)] border-[var(--toast-success-border)]',
		textClass: 'text-[var(--toast-success-text)]',
	},
	warning: {
		icon: AlertCircle,
		containerClass: 'bg-[var(--toast-warning-bg)] border-[var(--toast-warning-border)]',
		textClass: 'text-[var(--toast-warning-text)]',
	},
	info: {
		icon: Info,
		containerClass: 'bg-[var(--toast-info-bg)] border-[var(--toast-info-border)]',
		textClass: 'text-[var(--toast-info-text)]',
	},
}

/**
 * FormFeedback - Consistent feedback display for forms
 *
 * Displays error, success, warning, or info messages with appropriate
 * styling and icons. Only renders when a message is provided.
 *
 * @example
 * // Single message
 * <FormFeedback error={formError} />
 * <FormFeedback success="Changes saved successfully" />
 *
 * @example
 * // Multiple messages (all will render)
 * <FormFeedback error={error} success={success} />
 */
export function FormFeedback({ error, success, warning, info, className }: FormFeedbackProps) {
	const messages: Array<{ variant: FeedbackVariant; message: string }> = []

	if (error) messages.push({ variant: 'error', message: error })
	if (success) messages.push({ variant: 'success', message: success })
	if (warning) messages.push({ variant: 'warning', message: warning })
	if (info) messages.push({ variant: 'info', message: info })

	if (messages.length === 0) return null

	return (
		<div className={cn('space-y-2', className)}>
			{messages.map(({ variant, message }) => {
				const config = variantConfig[variant]
				const Icon = config.icon

				return (
					<div
						key={`${variant}-${message}`}
						className={cn(
							'flex items-start gap-2 rounded-lg border p-3 text-sm',
							config.containerClass,
						)}
						role={variant === 'error' ? 'alert' : 'status'}
						aria-live={variant === 'error' ? 'assertive' : 'polite'}
					>
						<Icon className={cn('mt-0.5 h-4 w-4 shrink-0', config.textClass)} aria-hidden="true" />
						<p className={config.textClass}>{message}</p>
					</div>
				)
			})}
		</div>
	)
}

/**
 * Inline feedback for form fields
 * Smaller, simpler variant for inline validation messages
 */
export function InlineFeedback({
	message,
	variant = 'error',
	className,
}: {
	message?: string | null
	variant?: FeedbackVariant
	className?: string
}) {
	if (!message) return null

	const config = variantConfig[variant]

	return (
		<p
			className={cn('mt-1 text-sm', config.textClass, className)}
			role={variant === 'error' ? 'alert' : 'status'}
		>
			{message}
		</p>
	)
}
