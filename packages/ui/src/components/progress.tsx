'use client'

import { Progress as BaseProgress } from '@base-ui/react/progress'
import { forwardRef } from 'react'
import { cn } from '../utils'

// ==================
// Linear Progress (Base UI)
// ==================

interface ProgressProps {
	/** Progress value (0-100). null for indeterminate */
	value: number | null
	/** Maximum value */
	max?: number
	/** Minimum value */
	min?: number
	/** Size variant */
	size?: 'sm' | 'md' | 'lg'
	/** Color variant */
	variant?: 'default' | 'success' | 'warning' | 'error'
	/** Whether to show the percentage label */
	showLabel?: boolean
	/** Additional CSS classes */
	className?: string
}

const sizeStyles = {
	sm: 'h-1',
	md: 'h-2',
	lg: 'h-3',
}

const variantStyles = {
	default: 'bg-primary',
	success: 'bg-success',
	warning: 'bg-warning',
	error: 'bg-error',
}

const Progress = forwardRef<HTMLDivElement, ProgressProps>(
	({ className, value, max = 100, min = 0, size = 'md', variant = 'default', showLabel = false }, ref) => {
		const percentage = value !== null ? Math.min(Math.max(((value - min) / (max - min)) * 100, 0), 100) : null

		return (
			<BaseProgress.Root
				ref={ref}
				value={value}
				max={max}
				min={min}
				className={className}
			>
				{showLabel && (
					<div className="mb-1 flex justify-between text-sm">
						<BaseProgress.Label className="text-muted-foreground">Progress</BaseProgress.Label>
						<BaseProgress.Value className="font-medium">
							{(formattedValue) => `${formattedValue}%`}
						</BaseProgress.Value>
					</div>
				)}
				<BaseProgress.Track
					className={cn('relative w-full overflow-hidden rounded-full bg-muted', sizeStyles[size])}
				>
					<BaseProgress.Indicator
						className={cn(
							'h-full rounded-full transition-all duration-500',
							variantStyles[variant],
							// Indeterminate animation
							'data-[indeterminate]:animate-progress-indeterminate',
						)}
						style={percentage !== null ? { width: `${percentage}%` } : undefined}
					/>
				</BaseProgress.Track>
			</BaseProgress.Root>
		)
	},
)
Progress.displayName = 'Progress'

// ==================
// Circular Progress (custom - Base UI doesn't have this)
// ==================

interface CircularProgressProps {
	/** Progress value (0-100). undefined for indeterminate */
	value?: number
	/** Size in pixels */
	size?: number
	/** Stroke width in pixels */
	strokeWidth?: number
	/** Additional CSS classes */
	className?: string
}

function CircularProgress({ value, size = 40, strokeWidth = 4, className }: CircularProgressProps) {
	const radius = (size - strokeWidth) / 2
	const circumference = radius * 2 * Math.PI
	const isIndeterminate = value === undefined

	return (
		<div
			className={cn('relative', className)}
			style={{ width: size, height: size }}
			role="progressbar"
			aria-valuenow={isIndeterminate ? undefined : value}
			aria-valuemin={0}
			aria-valuemax={100}
		>
			<svg
				className={cn('transform -rotate-90', isIndeterminate && 'animate-spin')}
				width={size}
				height={size}
				aria-hidden="true"
			>
				{/* Background circle */}
				<circle
					cx={size / 2}
					cy={size / 2}
					r={radius}
					fill="none"
					stroke="currentColor"
					strokeWidth={strokeWidth}
					className="text-muted"
				/>
				{/* Progress circle */}
				<circle
					cx={size / 2}
					cy={size / 2}
					r={radius}
					fill="none"
					stroke="currentColor"
					strokeWidth={strokeWidth}
					strokeDasharray={circumference}
					strokeDashoffset={
						isIndeterminate ? circumference * 0.75 : circumference * (1 - (value || 0) / 100)
					}
					strokeLinecap="round"
					className="text-primary transition-all duration-500"
				/>
			</svg>
			{!isIndeterminate && (
				<span className="absolute inset-0 flex items-center justify-center text-xs font-medium">
					{Math.round(value || 0)}%
				</span>
			)}
		</div>
	)
}

export { Progress, CircularProgress }
export type { ProgressProps, CircularProgressProps }
