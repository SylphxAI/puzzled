'use client'

import { ArrowDown, ArrowUp, Flame, Medal, Minus, Trophy } from 'lucide-react'
import Image from 'next/image'
import { useLocale } from 'next-intl'
import { cn } from '@/lib/utils'
import { AvatarIcon } from '@sylphx/ui'

type RankChange = 'up' | 'down' | 'same' | 'new'

export type LeaderboardEntryData = {
	rank: number
	previousRank?: number // For rank change indicator
	name: string
	avatarUrl?: string
	avatarIndex?: number
	value: number
	metric: 'streak' | 'score' | 'wins'
	isCurrentUser?: boolean
}

type LeaderboardEntryProps = {
	entry: LeaderboardEntryData
	metricLabel: string
	showRankChange?: boolean
	onClick?: () => void
}

function getRankChange(current: number, previous?: number): RankChange {
	if (previous === undefined) return 'new'
	if (current < previous) return 'up'
	if (current > previous) return 'down'
	return 'same'
}

function getRankChangeValue(current: number, previous?: number): number {
	if (previous === undefined) return 0
	return Math.abs(current - previous)
}

export function LeaderboardEntry({
	entry,
	metricLabel,
	showRankChange = true,
	onClick,
}: LeaderboardEntryProps) {
	const locale = useLocale()
	const rankChange = getRankChange(entry.rank, entry.previousRank)
	const changeValue = getRankChangeValue(entry.rank, entry.previousRank)

	return (
		<div
			onClick={onClick}
			className={cn(
				'flex items-center gap-3 p-3 transition-colors',
				entry.rank <= 3 && 'bg-muted/30',
				entry.isCurrentUser && 'bg-primary/10 ring-1 ring-primary/20',
				onClick && 'cursor-pointer hover:bg-muted/50',
			)}
		>
			{/* Rank with medal */}
			<div className="flex h-8 w-8 items-center justify-center">
				{entry.rank === 1 ? (
					<Trophy className="h-6 w-6 text-rank-gold" aria-label="1st place" />
				) : entry.rank === 2 ? (
					<Medal className="h-6 w-6 text-rank-silver" aria-label="2nd place" />
				) : entry.rank === 3 ? (
					<Medal className="h-6 w-6 text-rank-bronze" aria-label="3rd place" />
				) : (
					<span className="text-sm font-medium text-muted-foreground">{entry.rank}</span>
				)}
			</div>

			{/* Rank change indicator */}
			{showRankChange && (
				<div className="w-6 text-center">
					{rankChange === 'up' && (
						<span className="flex items-center text-green-500" title={`Up ${changeValue}`}>
							<ArrowUp className="h-3 w-3" />
							<span className="text-xs">{changeValue}</span>
						</span>
					)}
					{rankChange === 'down' && (
						<span className="flex items-center text-red-500" title={`Down ${changeValue}`}>
							<ArrowDown className="h-3 w-3" />
							<span className="text-xs">{changeValue}</span>
						</span>
					)}
					{rankChange === 'same' && <Minus className="h-3 w-3 text-muted-foreground" />}
					{rankChange === 'new' && <span className="text-xs font-medium text-primary">NEW</span>}
				</div>
			)}

			{/* Avatar */}
			<div className="shrink-0">
				{entry.avatarUrl ? (
					<Image
						src={entry.avatarUrl}
						alt={`${entry.name}'s avatar`}
						width={40}
						height={40}
						className="h-10 w-10 rounded-full object-cover"
					/>
				) : (
					<AvatarIcon index={entry.avatarIndex || 0} size={40} className="text-muted-foreground" />
				)}
			</div>

			{/* Name */}
			<div className="min-w-0 flex-1">
				<p className={cn('truncate font-medium', entry.isCurrentUser && 'text-primary')}>
					{entry.name}
					{entry.isCurrentUser && <span className="ml-1 text-xs">(You)</span>}
				</p>
			</div>

			{/* Metric value */}
			<div className="flex items-center gap-1.5 text-right">
				{entry.metric === 'streak' && (
					<Flame className="h-4 w-4 text-stat-streak" aria-hidden="true" />
				)}
				<span className="font-bold">
					{entry.metric === 'score' ? entry.value.toLocaleString(locale) : entry.value}
				</span>
				<span className="text-xs text-muted-foreground">{metricLabel}</span>
			</div>
		</div>
	)
}

// Compact version for inline display
export function LeaderboardPosition({
	rank,
	previousRank,
	className,
}: {
	rank: number
	previousRank?: number
	className?: string
}) {
	const rankChange = getRankChange(rank, previousRank)
	const changeValue = getRankChangeValue(rank, previousRank)

	return (
		<div className={cn('flex items-center gap-1', className)}>
			<span className="font-bold">#{rank}</span>
			{rankChange === 'up' && (
				<span className="flex items-center text-green-500">
					<ArrowUp className="h-3 w-3" />
					<span className="text-xs">{changeValue}</span>
				</span>
			)}
			{rankChange === 'down' && (
				<span className="flex items-center text-red-500">
					<ArrowDown className="h-3 w-3" />
					<span className="text-xs">{changeValue}</span>
				</span>
			)}
		</div>
	)
}
