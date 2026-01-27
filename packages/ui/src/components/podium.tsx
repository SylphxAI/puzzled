'use client'

import { Crown, Medal, Trophy } from 'lucide-react'
import { cn } from '../utils'
import { AvatarIcon } from './game-icons'

type PodiumEntry = {
	rank: number
	name: string
	avatarIndex: number
	value: number
}

type PodiumProps = {
	entries: PodiumEntry[]
	/** Label for the metric (e.g., "streak", "pts") */
	metricLabel: string
	/** Locale for number formatting */
	locale?: string
	className?: string
}

/**
 * Podium - Visual ranking display for top 3 players
 *
 * Features:
 * - Olympic-style podium with 2nd, 1st, 3rd positioning
 * - Animated entrance and hover effects
 * - Gradient backgrounds for each position
 * - Crown icon for 1st place
 */
export function Podium({ entries, metricLabel, locale = 'en', className }: PodiumProps) {
	// Need at least 3 entries for full podium, pad with empty if needed
	const paddedEntries = [...entries]
	while (paddedEntries.length < 3) {
		paddedEntries.push({
			rank: paddedEntries.length + 1,
			name: '—',
			avatarIndex: 0,
			value: 0,
		})
	}

	// Reorder to: 2nd, 1st, 3rd (podium visual order)
	const podiumOrder = [paddedEntries[1]!, paddedEntries[0]!, paddedEntries[2]!]

	const heights = ['h-20', 'h-28', 'h-16'] // 2nd, 1st, 3rd
	const positions = [2, 1, 3]
	const gradients = [
		'from-rank-silver/20 to-rank-silver/10', // Silver
		'from-rank-gold/25 to-rank-gold/15', // Gold
		'from-rank-bronze/20 to-rank-bronze/10', // Bronze
	]
	const iconColors = ['text-rank-silver', 'text-rank-gold', 'text-rank-bronze']
	const borderColors = [
		'border-rank-silver/50',
		'border-rank-gold/50',
		'border-rank-bronze/50',
	]

	return (
		<div className={cn('flex items-end justify-center gap-2 sm:gap-4', className)}>
			{podiumOrder.map((entry, i) => {
				const isEmpty = entry.name === '—'

				return (
					<div
						key={positions[i]}
						className={cn(
							'podium-entry flex flex-col items-center',
							i === 1 && 'podium-entry-1st',
							i === 0 && 'podium-entry-2nd',
							i === 2 && 'podium-entry-3rd',
						)}
					>
						{/* Player info above podium */}
						<div
							className={cn(
								'mb-2 flex flex-col items-center transition-transform',
								!isEmpty && 'hover:scale-105',
							)}
						>
							{/* Crown for 1st place */}
							{positions[i] === 1 && !isEmpty && (
								<Crown className="podium-crown mb-1 h-5 w-5 text-rank-gold" />
							)}

							{/* Avatar */}
							<div
								className={cn(
									'relative flex h-12 w-12 items-center justify-center rounded-full border-2 bg-gradient-to-br sm:h-14 sm:w-14',
									gradients[i],
									borderColors[i],
									isEmpty && 'opacity-30',
								)}
							>
								{isEmpty ? (
									<span className="text-muted-foreground/50">?</span>
								) : (
									<AvatarIcon index={entry.avatarIndex} size={32} className={iconColors[i]} />
								)}

								{/* Position badge */}
								<div
									className={cn(
										'absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-background text-[10px] font-bold',
										positions[i] === 1 && 'bg-rank-gold text-foreground',
										positions[i] === 2 && 'bg-rank-silver text-foreground',
										positions[i] === 3 && 'bg-rank-bronze text-foreground',
									)}
								>
									{positions[i]}
								</div>
							</div>

							{/* Name */}
							<p
								className={cn(
									'mt-1.5 max-w-16 truncate text-center text-xs font-medium sm:max-w-20 sm:text-sm',
									isEmpty && 'text-muted-foreground/50',
								)}
							>
								{entry.name}
							</p>

							{/* Value */}
							{!isEmpty && (
								<p className="flex items-center gap-0.5 text-xs text-muted-foreground">
									<span className="font-semibold">{entry.value.toLocaleString(locale)}</span>
									<span>{metricLabel}</span>
								</p>
							)}
						</div>

						{/* Podium base */}
						<div
							className={cn(
								'w-20 rounded-t-lg border-x border-t bg-gradient-to-t transition-shadow sm:w-24',
								heights[i],
								gradients[i],
								borderColors[i],
								!isEmpty && 'shadow-lg hover:shadow-xl',
							)}
						>
							{/* Trophy/Medal icon in podium */}
							<div className="flex h-full items-center justify-center">
								{positions[i] === 1 ? (
									<Trophy className={cn('h-8 w-8 sm:h-10 sm:w-10', iconColors[i])} />
								) : (
									<Medal className={cn('h-6 w-6 sm:h-8 sm:w-8', iconColors[i])} />
								)}
							</div>
						</div>
					</div>
				)
			})}
		</div>
	)
}
