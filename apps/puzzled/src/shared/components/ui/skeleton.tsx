import { cn } from '@/lib/utils'

type SkeletonProps = {
	className?: string
}

/**
 * Base Skeleton component with shimmer animation
 *
 * Features:
 * - Smooth shimmer effect using gradient animation
 * - Rounded corners with theme colors
 * - Accepts className for custom sizing
 */
export function Skeleton({ className }: SkeletonProps) {
	return (
		<div
			className={cn(
				'relative overflow-hidden rounded-md bg-muted',
				'before:absolute before:inset-0',
				'before:-translate-x-full before:animate-[shimmer_2s_infinite]',
				'before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent',
				className,
			)}
		/>
	)
}

/**
 * SkeletonText - Single or multi-line text placeholder
 *
 * Usage:
 * - Single line: <SkeletonText />
 * - Multiple lines: <SkeletonText lines={3} />
 * - Last line is automatically shorter for natural appearance
 */
export function SkeletonText({ className, lines = 1 }: SkeletonProps & { lines?: number }) {
	return (
		<div className={cn('space-y-2', className)}>
			{Array.from({ length: lines }).map((_, i) => (
				<Skeleton
					key={i}
					className={cn('h-4', i === lines - 1 && lines > 1 ? 'w-3/4' : 'w-full')}
				/>
			))}
		</div>
	)
}

/**
 * SkeletonAvatar - Circular avatar placeholder
 *
 * Usage:
 * - Default: <SkeletonAvatar />
 * - Custom size: <SkeletonAvatar className="h-16 w-16" />
 */
export function SkeletonAvatar({ className }: SkeletonProps) {
	return <Skeleton className={cn('h-10 w-10 rounded-full', className)} />
}

/**
 * SkeletonButton - Button-shaped placeholder
 *
 * Matches Button component sizes:
 * - default: h-11
 * - sm: h-10
 * - lg: h-12
 */
export function SkeletonButton({
	className,
	size = 'default',
}: SkeletonProps & { size?: 'default' | 'sm' | 'lg' }) {
	return (
		<Skeleton
			className={cn(
				'rounded-lg',
				size === 'default' && 'h-11 w-24',
				size === 'sm' && 'h-10 w-20',
				size === 'lg' && 'h-12 w-28',
				className,
			)}
		/>
	)
}

/**
 * SkeletonCard - Generic card placeholder
 *
 * Features:
 * - Avatar + text content layout
 * - Border and padding matching Card component
 */
export function SkeletonCard({ className }: SkeletonProps) {
	return (
		<div className={cn('rounded-xl border bg-card p-4 sm:p-6', className)}>
			<div className="flex items-center gap-4">
				<SkeletonAvatar className="h-12 w-12" />
				<div className="flex-1 space-y-2">
					<Skeleton className="h-4 w-1/2" />
					<Skeleton className="h-3 w-3/4" />
				</div>
			</div>
		</div>
	)
}

/**
 * GameCardSkeleton - Matches DailyHero game card layout
 *
 * Structure:
 * - Large icon (56x56)
 * - Badge area (top right)
 * - Title + tagline
 * - Stats row
 * - Action button
 */
export function GameCardSkeleton({ className }: SkeletonProps) {
	return (
		<div className={cn('rounded-xl border bg-card p-4', className)}>
			{/* Header: Icon + Badge */}
			<div className="mb-3 flex items-start justify-between">
				<Skeleton className="h-14 w-14 rounded-2xl" />
				<Skeleton className="h-6 w-20 rounded-full" />
			</div>

			{/* Title */}
			<Skeleton className="h-5 w-2/3" />

			{/* Tagline */}
			<Skeleton className="mt-2 h-4 w-full" />

			{/* Stats row */}
			<div className="mt-3 flex items-center gap-3">
				<Skeleton className="h-4 w-16" />
				<Skeleton className="h-4 w-20" />
			</div>

			{/* Action button */}
			<Skeleton className="mt-4 h-10 w-full rounded-xl" />
		</div>
	)
}

/**
 * StatsRowSkeleton - Matches Quick Stats Row on home page
 *
 * Features:
 * - 3 stat cards in grid layout
 * - Icon + value + label per card
 * - Matches responsive sizing (2 cols mobile, 3 cols desktop)
 */
export function StatsRowSkeleton({ className }: SkeletonProps) {
	return (
		<div className={cn('grid grid-cols-3 gap-3', className)}>
			{Array.from({ length: 3 }).map((_, i) => (
				<div key={i} className="flex items-center gap-2 rounded-xl bg-muted/50 p-3">
					<Skeleton className="h-8 w-8 rounded-lg" />
					<div className="flex-1 space-y-1">
						<Skeleton className="h-5 w-12" />
						<Skeleton className="h-3 w-16" />
					</div>
				</div>
			))}
		</div>
	)
}

/**
 * LeaderboardEntrySkeleton - Matches leaderboard row layout
 *
 * Structure:
 * - Rank number
 * - Avatar
 * - Name + subtitle
 * - Score/value
 */
export function LeaderboardEntrySkeleton({
	className,
	rows = 5,
}: SkeletonProps & { rows?: number }) {
	return (
		<div className={cn('space-y-3', className)}>
			{Array.from({ length: rows }).map((_, i) => (
				<div key={i} className="flex items-center gap-3 rounded-lg border bg-card p-3">
					{/* Rank */}
					<Skeleton className="h-6 w-6 rounded" />

					{/* Avatar */}
					<SkeletonAvatar />

					{/* Name + subtitle */}
					<div className="flex-1 space-y-1">
						<Skeleton className="h-4 w-1/3" />
						<Skeleton className="h-3 w-1/4" />
					</div>

					{/* Score */}
					<Skeleton className="h-6 w-12 rounded" />
				</div>
			))}
		</div>
	)
}
