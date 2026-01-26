'use client'

import { Card } from '@sylphx/ui'
import { Flame, Percent, Target, Trophy } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

type StatItem = {
	id: string
	value: number
	label: string
	icon: React.ReactNode
	iconBg: string
	suffix?: string
	prefix?: string
}

type QuickStatsProps = {
	gamesPlayed: number
	winRate: number
	currentStreak: number
	bestStreak: number
	className?: string
	variant?: 'grid' | 'row'
	animate?: boolean
}

/**
 * Animated counter hook for number animation
 */
function useAnimatedNumber(target: number, duration: number = 1000, enabled: boolean = true) {
	const [current, setCurrent] = useState(0)

	useEffect(() => {
		if (!enabled) {
			setCurrent(target)
			return
		}

		let startTime: number
		let animationFrame: number

		const animate = (timestamp: number) => {
			if (!startTime) startTime = timestamp
			const elapsed = timestamp - startTime
			const progress = Math.min(elapsed / duration, 1)

			// Ease out cubic for smooth deceleration
			const eased = 1 - (1 - progress) ** 3
			setCurrent(Math.floor(eased * target))

			if (progress < 1) {
				animationFrame = requestAnimationFrame(animate)
			}
		}

		animationFrame = requestAnimationFrame(animate)
		return () => cancelAnimationFrame(animationFrame)
	}, [target, duration, enabled])

	return current
}

/**
 * Single stat card with animation
 */
function StatCard({ stat, index, animate }: { stat: StatItem; index: number; animate: boolean }) {
	const displayValue = useAnimatedNumber(stat.value, 800 + index * 200, animate)

	return (
		<Card
			className={cn(
				'p-3 sm:p-4',
				animate && 'animate-slide-up-fade opacity-0',
				animate && `stagger-${index + 1}`,
			)}
		>
			<div className="flex items-center gap-2 sm:gap-3">
				<div
					className={cn(
						'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:h-11 sm:w-11',
						stat.iconBg,
					)}
				>
					{stat.icon}
				</div>
				<div className="min-w-0 flex-1">
					<p className="text-lg font-bold tabular-nums sm:text-xl" style={{ minWidth: '3ch' }}>
						{stat.prefix}
						{displayValue}
						{stat.suffix}
					</p>
					<p className="truncate text-xs text-muted-foreground">{stat.label}</p>
				</div>
			</div>
		</Card>
	)
}

/**
 * QuickStats - Grid of animated stat cards
 *
 * Features:
 * - Animated number counting on mount
 * - Staggered reveal animation
 * - Grid or row layout options
 * - Mobile-optimized sizing
 */
export function QuickStats({
	gamesPlayed,
	winRate,
	currentStreak,
	bestStreak,
	className,
	variant = 'grid',
	animate = true,
}: QuickStatsProps) {
	const t = useTranslations('stats')
	const tStreak = useTranslations('streak')

	const stats: StatItem[] = [
		{
			id: 'games',
			value: gamesPlayed,
			label: t('gamesPlayed'),
			icon: <Target className="h-4 w-4 text-stat-games sm:h-5 sm:w-5" aria-hidden="true" />,
			iconBg: 'bg-stat-games/10',
		},
		{
			id: 'winRate',
			value: Math.round(winRate),
			label: t('winRate'),
			icon: <Percent className="h-4 w-4 text-stat-winrate sm:h-5 sm:w-5" aria-hidden="true" />,
			iconBg: 'bg-stat-winrate/10',
			suffix: '%',
		},
		{
			id: 'streak',
			value: currentStreak,
			label: tStreak('currentStreak'),
			icon: <Flame className="h-4 w-4 text-stat-streak sm:h-5 sm:w-5" aria-hidden="true" />,
			iconBg: 'bg-stat-streak/10',
		},
		{
			id: 'best',
			value: bestStreak,
			label: tStreak('bestStreak'),
			icon: <Trophy className="h-4 w-4 text-stat-best sm:h-5 sm:w-5" aria-hidden="true" />,
			iconBg: 'bg-stat-best/10',
		},
	]

	return (
		<div
			className={cn(
				variant === 'grid'
					? 'grid grid-cols-2 gap-2 sm:gap-3'
					: 'flex gap-2 overflow-x-auto sm:gap-3',
				className,
			)}
		>
			{stats.map((stat, index) => (
				<StatCard key={stat.id} stat={stat} index={index} animate={animate} />
			))}
		</div>
	)
}
