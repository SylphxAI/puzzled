/**
 * @sylphx/ui - Input Components
 *
 * Accessible form input and textarea components with built-in
 * label, error, and helper text support.
 *
 * @example
 * ```tsx
 * import { Input, Textarea } from '@sylphx/ui'
 *
 * // Basic input
 * <Input placeholder="Enter your email" />
 *
 * // With label and helper text
 * <Input
 *   label="Email"
 *   placeholder="you@example.com"
 *   helperText="We'll never share your email"
 * />
 *
 * // With error state
 * <Input
 *   label="Password"
 *   type="password"
 *   error="Password must be at least 8 characters"
 * />
 *
 * // Textarea
 * <Textarea
 *   label="Message"
 *   placeholder="Write your message..."
 *   rows={4}
 * />
 * ```
 *
 * @module @sylphx/ui/input
 */

import { forwardRef, useId } from 'react'
import { cn } from '../utils'

/**
 * Props for the Input component.
 * Extends native input attributes with additional styling options.
 *
 * @property label - Label text displayed above the input
 * @property error - Error message displayed below the input (turns input red)
 * @property helperText - Helper text displayed below the input (hidden when error exists)
 */
export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
	/** Label text displayed above the input */
	label?: string
	/** Error message displayed below the input. Shows error styling when present. */
	error?: string
	/** Helper text displayed below the input. Hidden when error is present. */
	helperText?: string
}

/**
 * Input component with built-in label, error, and helper text support.
 *
 * Features:
 * - Auto-generated IDs for accessibility (label + input association)
 * - Error and helper text with proper aria-describedby
 * - Visual error states with red border/ring
 * - Meets accessibility touch targets (h-11 / 44px)
 * - Focus ring and hover states
 *
 * @example
 * ```tsx
 * <Input
 *   label="Email"
 *   type="email"
 *   placeholder="you@example.com"
 *   error={errors.email?.message}
 * />
 * ```
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
	({ className, label, error, helperText, type = 'text', id, ...props }, ref) => {
		const generatedId = useId()
		const inputId = id || generatedId

		return (
			<div className="w-full">
				{label && (
					<label htmlFor={inputId} className="mb-1.5 block text-sm font-medium">
						{label}
					</label>
				)}
				<input
					type={type}
					id={inputId}
					className={cn(
						'flex h-11 w-full rounded-lg border bg-background px-3 py-2 text-base transition-colors',
						'placeholder:text-muted-foreground',
						'hover:border-primary/50',
						'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:border-primary',
						'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border',
						error && 'border-error hover:border-error focus-visible:ring-error/50 focus-visible:border-error',
						className,
					)}
					ref={ref}
					aria-invalid={error ? 'true' : 'false'}
					aria-describedby={
						error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined
					}
					{...props}
				/>
				{error && (
					<p id={`${inputId}-error`} className="mt-1.5 text-sm text-error">
						{error}
					</p>
				)}
				{helperText && !error && (
					<p id={`${inputId}-helper`} className="mt-1.5 text-sm text-muted-foreground">
						{helperText}
					</p>
				)}
			</div>
		)
	},
)

Input.displayName = 'Input'

/**
 * Props for the Textarea component.
 * Extends native textarea attributes with additional styling options.
 *
 * @property label - Label text displayed above the textarea
 * @property error - Error message displayed below the textarea (turns textarea red)
 * @property helperText - Helper text displayed below the textarea (hidden when error exists)
 */
export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
	/** Label text displayed above the textarea */
	label?: string
	/** Error message displayed below the textarea. Shows error styling when present. */
	error?: string
	/** Helper text displayed below the textarea. Hidden when error is present. */
	helperText?: string
}

/**
 * Textarea component with built-in label, error, and helper text support.
 *
 * Features:
 * - Auto-generated IDs for accessibility
 * - Error and helper text with proper aria-describedby
 * - Visual error states with red border/ring
 * - Resizable by default (min-h-[80px])
 * - Focus ring and hover states
 *
 * @example
 * ```tsx
 * <Textarea
 *   label="Description"
 *   placeholder="Describe your issue..."
 *   rows={4}
 *   error={errors.description?.message}
 * />
 * ```
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
	({ className, label, error, helperText, id, ...props }, ref) => {
		const generatedId = useId()
		const textareaId = id || generatedId

		return (
			<div className="w-full">
				{label && (
					<label htmlFor={textareaId} className="mb-1.5 block text-sm font-medium">
						{label}
					</label>
				)}
				<textarea
					id={textareaId}
					className={cn(
						'flex min-h-[80px] w-full rounded-lg border bg-background px-3 py-2 text-base transition-colors',
						'placeholder:text-muted-foreground',
						'hover:border-primary/50',
						'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:border-primary',
						'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border',
						error && 'border-error hover:border-error focus-visible:ring-error/50 focus-visible:border-error',
						className,
					)}
					ref={ref}
					aria-invalid={error ? 'true' : 'false'}
					aria-describedby={
						error ? `${textareaId}-error` : helperText ? `${textareaId}-helper` : undefined
					}
					{...props}
				/>
				{error && (
					<p id={`${textareaId}-error`} className="mt-1.5 text-sm text-error">
						{error}
					</p>
				)}
				{helperText && !error && (
					<p id={`${textareaId}-helper`} className="mt-1.5 text-sm text-muted-foreground">
						{helperText}
					</p>
				)}
			</div>
		)
	},
)

Textarea.displayName = 'Textarea'
