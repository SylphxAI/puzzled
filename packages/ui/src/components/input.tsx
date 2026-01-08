import { forwardRef, useId } from 'react'
import { cn } from '../utils'

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
	label?: string
	error?: string
	helperText?: string
}

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
						'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary',
						'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border',
						error && 'border-error hover:border-error focus:ring-error/50 focus:border-error',
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

// Textarea variant
export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
	label?: string
	error?: string
	helperText?: string
}

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
						'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary',
						'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border',
						error && 'border-error hover:border-error focus:ring-error/50 focus:border-error',
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
