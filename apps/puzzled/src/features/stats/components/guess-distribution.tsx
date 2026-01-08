'use client'

import { cn } from '@/lib/utils'

type GuessDistributionProps = {
	distribution: Record<number, number> // {1: 42, 2: 28, ...}
	maxAttempts: number // 6 for Wordle
	highlight?: number // Current game's guess count to highlight
	className?: string
}

export function GuessDistribution({
	distribution,
	maxAttempts,
	highlight,
	className,
}: GuessDistributionProps) {
	const maxCount = Math.max(...Object.values(distribution), 1)
	const total = Object.values(distribution).reduce((sum, count) => sum + count, 0)

	return (
		<div className={cn('space-y-1.5', className)}>
			{Array.from({ length: maxAttempts }, (_, i) => i + 1).map((guess) => {
				const count = distribution[guess] || 0
				const percentage = total > 0 ? (count / total) * 100 : 0
				const barWidth = maxCount > 0 ? (count / maxCount) * 100 : 0
				const isHighlighted = guess === highlight

				return (
					<div key={guess} className="flex items-center gap-2">
						<span className="w-4 text-center text-sm font-medium">{guess}</span>
						<div className="flex-1">
							<div
								className={cn(
									'flex h-6 items-center justify-end rounded px-2 transition-all duration-500',
									isHighlighted ? 'bg-green-500' : count > 0 ? 'bg-primary' : 'bg-muted',
								)}
								style={{ width: `${Math.max(barWidth, 8)}%` }}
							>
								<span
									className={cn(
										'text-xs font-medium',
										count > 0 ? 'text-primary-foreground' : 'text-muted-foreground',
									)}
								>
									{count}
								</span>
							</div>
						</div>
						<span className="w-12 text-right text-xs text-muted-foreground">
							{percentage.toFixed(0)}%
						</span>
					</div>
				)
			})}
		</div>
	)
}

// Compact horizontal version for inline display
export function GuessDistributionCompact({
	distribution,
	maxAttempts,
	className,
}: {
	distribution: Record<number, number>
	maxAttempts: number
	className?: string
}) {
	const total = Object.values(distribution).reduce((sum, count) => sum + count, 0)
	if (total === 0) return null

	return (
		<div className={cn('flex h-4 w-full overflow-hidden rounded-full', className)}>
			{Array.from({ length: maxAttempts }, (_, i) => i + 1).map((guess) => {
				const count = distribution[guess] || 0
				const percentage = (count / total) * 100
				if (percentage === 0) return null

				const colors = [
					'bg-green-500', // 1
					'bg-green-400', // 2
					'bg-yellow-400', // 3
					'bg-yellow-500', // 4
					'bg-orange-400', // 5
					'bg-orange-500', // 6
				]

				return (
					<div
						key={guess}
						className={cn(colors[guess - 1] || 'bg-muted', 'h-full')}
						style={{ width: `${percentage}%` }}
						title={`${guess}: ${count} (${percentage.toFixed(1)}%)`}
					/>
				)
			})}
		</div>
	)
}
