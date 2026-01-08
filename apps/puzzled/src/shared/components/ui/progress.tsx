'use client'

import * as ProgressPrimitive from '@radix-ui/react-progress'
import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

// ==================
// Linear Progress (Radix-based)
// ==================

type ProgressProps = React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & {
	value: number // 0-100
	max?: number
	size?: 'sm' | 'md' | 'lg'
	variant?: 'default' | 'success' | 'warning' | 'error'
	showLabel?: boolean
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

const Progress = forwardRef<React.ElementRef<typeof ProgressPrimitive.Root>, ProgressProps>(
	({ className, value, max = 100, size = 'md', variant = 'default', showLabel = false, ...props }, ref) => {
		const percentage = Math.min(Math.max((value / max) * 100, 0), 100)

		return (
			<div className={className}>
				{showLabel && (
					<div className="mb-1 flex justify-between text-sm">
						<span className="text-muted-foreground">Progress</span>
						<span className="font-medium">{Math.round(percentage)}%</span>
					</div>
				)}
				<ProgressPrimitive.Root
					ref={ref}
					className={cn('relative w-full overflow-hidden rounded-full bg-muted', sizeStyles[size])}
					value={value}
					max={max}
					{...props}
				>
					<ProgressPrimitive.Indicator
						className={cn('h-full rounded-full transition-all duration-500', variantStyles[variant])}
						style={{ width: `${percentage}%` }}
					/>
				</ProgressPrimitive.Root>
			</div>
		)
	},
)
Progress.displayName = ProgressPrimitive.Root.displayName

// ==================
// Circular Progress (custom - Radix doesn't have this)
// ==================

type CircularProgressProps = {
	value?: number // undefined = indeterminate
	size?: number
	strokeWidth?: number
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
