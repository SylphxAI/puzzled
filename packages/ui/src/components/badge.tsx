import { cn } from '../utils'

type BadgeVariant = 'default' | 'secondary' | 'success' | 'warning' | 'error' | 'outline'
type BadgeSize = 'sm' | 'md' | 'lg'

type BadgeProps = {
	variant?: BadgeVariant
	size?: BadgeSize
	children: React.ReactNode
	className?: string
}

const variantStyles: Record<BadgeVariant, string> = {
	default: 'bg-primary text-primary-foreground',
	secondary: 'bg-muted text-muted-foreground',
	success: 'bg-success/10 text-success',
	warning: 'bg-warning/10 text-warning',
	error: 'bg-error/10 text-error',
	outline: 'border bg-transparent text-foreground',
}

const sizeStyles: Record<BadgeSize, string> = {
	sm: 'px-1.5 py-0.5 text-xs',
	md: 'px-2 py-0.5 text-xs',
	lg: 'px-2.5 py-1 text-sm',
}

export function Badge({ variant = 'default', size = 'md', children, className }: BadgeProps) {
	return (
		<span
			className={cn(
				'inline-flex items-center gap-1 rounded-full font-medium',
				variantStyles[variant],
				sizeStyles[size],
				className,
			)}
		>
			{children}
		</span>
	)
}

// Dot badge for status indicators
export function StatusDot({
	status,
	className,
}: {
	status: 'online' | 'offline' | 'away' | 'busy'
	className?: string
}) {
	const statusColors = {
		online: 'bg-success',
		offline: 'bg-muted-foreground',
		away: 'bg-warning',
		busy: 'bg-error',
	}

	return (
		<span
			className={cn('inline-block h-2 w-2 rounded-full', statusColors[status], className)}
			role="img"
			aria-label={status}
		/>
	)
}

// Count badge for notifications
export function CountBadge({
	count,
	max = 99,
	className,
}: {
	count: number
	max?: number
	className?: string
}) {
	if (count === 0) return null

	const displayCount = count > max ? `${max}+` : count

	return (
		<span
			className={cn(
				'inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-error px-1.5 text-xs font-bold text-error-foreground',
				className,
			)}
		>
			{displayCount}
		</span>
	)
}
