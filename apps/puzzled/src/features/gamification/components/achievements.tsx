'use client'

import { Lock } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
	ACHIEVEMENTS,
	type Achievement,
	checkAchievements,
	getNextAchievements,
	TIER_BG_COLORS,
	TIER_COLORS,
	type UserAchievement,
} from '@/features/gamification'
import { cn } from '@/lib/utils'
import { Icon } from '@sylphx/ui'

type AchievementsProps = {
	stats: {
		totalWins: number
		maxStreak: number
		wordleWins: number
		connectionsWins: number
		wordleBestAttempts?: number
		connectionsPerfectGames?: number
	}
}

export function Achievements({ stats }: AchievementsProps) {
	const t = useTranslations('achievements')
	const unlocked = checkAchievements(stats)
	const nextUp = getNextAchievements(stats)
	const unlockedIds = new Set(unlocked.map((a) => a.id))

	return (
		<div className="space-y-4">
			<h2 className="text-lg font-semibold">{t('title')}</h2>

			{/* Progress toward next achievements */}
			{nextUp.length > 0 && (
				<div className="space-y-2">
					<h3 className="text-sm font-medium text-muted-foreground">{t('nextUp')}</h3>
					<div className="space-y-2">
						{nextUp.map((achievement) => (
							<NextAchievementCard key={achievement.id} achievement={achievement} t={t} />
						))}
					</div>
				</div>
			)}

			{/* Unlocked achievements */}
			{unlocked.length > 0 && (
				<div className="space-y-2">
					<h3 className="text-sm font-medium text-muted-foreground">
						{t('unlocked')} ({unlocked.length})
					</h3>
					<div className="grid grid-cols-2 gap-2">
						{unlocked.map((achievement) => (
							<AchievementCard key={achievement.id} achievement={achievement} isUnlocked />
						))}
					</div>
				</div>
			)}

			{/* Locked achievements */}
			<div className="space-y-2">
				<h3 className="text-sm font-medium text-muted-foreground">
					{t('locked')} ({ACHIEVEMENTS.length - unlocked.length})
				</h3>
				<div className="grid grid-cols-2 gap-2">
					{ACHIEVEMENTS.filter((a) => !unlockedIds.has(a.id)).map((achievement) => (
						<AchievementCard key={achievement.id} achievement={achievement} isUnlocked={false} />
					))}
				</div>
			</div>
		</div>
	)
}

function AchievementCard({
	achievement,
	isUnlocked,
}: {
	achievement: Achievement
	isUnlocked: boolean
}) {
	return (
		<div
			className={cn(
				'flex items-center gap-3 rounded-lg border p-3 transition-colors',
				isUnlocked ? TIER_BG_COLORS[achievement.tier] : 'bg-muted/30 opacity-60',
			)}
		>
			<div
				className={cn(
					'flex h-10 w-10 items-center justify-center rounded-full',
					isUnlocked ? TIER_BG_COLORS[achievement.tier] : 'bg-muted',
				)}
			>
				{isUnlocked ? (
					<Icon
						icon={achievement.icon}
						aria-hidden="true"
						className={cn('h-5 w-5', TIER_COLORS[achievement.tier])}
					/>
				) : (
					<Lock className="h-4 w-4 text-muted-foreground" />
				)}
			</div>
			<div className="min-w-0 flex-1">
				<div className={cn('truncate text-sm font-medium', !isUnlocked && 'text-muted-foreground')}>
					{achievement.name}
				</div>
				<div className="truncate text-xs text-muted-foreground">{achievement.description}</div>
			</div>
		</div>
	)
}

function NextAchievementCard({
	achievement,
	t,
}: {
	achievement: UserAchievement
	t: ReturnType<typeof useTranslations<'achievements'>>
}) {
	const progress = achievement.progress ?? 0
	const target = achievement.target ?? 1
	const percentage = Math.min((progress / target) * 100, 100)

	return (
		<div className={cn('rounded-lg border p-3', TIER_BG_COLORS[achievement.tier])}>
			<div className="flex items-center gap-3">
				<div
					className={cn(
						'flex h-10 w-10 items-center justify-center rounded-full',
						TIER_BG_COLORS[achievement.tier],
					)}
				>
					<Icon
						icon={achievement.icon}
						aria-hidden="true"
						className={cn('h-5 w-5', TIER_COLORS[achievement.tier])}
					/>
				</div>
				<div className="min-w-0 flex-1">
					<div className="truncate text-sm font-medium">{achievement.name}</div>
					<div className="truncate text-xs text-muted-foreground">{achievement.description}</div>
				</div>
			</div>
			<div className="mt-3">
				<div className="mb-1 flex justify-between text-xs">
					<span className="text-muted-foreground">{t('progress')}</span>
					<span className="font-medium">
						{progress} / {target}
					</span>
				</div>
				<div className="h-2 overflow-hidden rounded-full bg-muted">
					<div
						className={cn(
							'h-full rounded-full transition-all',
							TIER_COLORS[achievement.tier].replace('text-', 'bg-'),
						)}
						style={{ width: `${percentage}%` }}
					/>
				</div>
			</div>
		</div>
	)
}

// Compact version for showing on home page or profile
function AchievementBadges({ stats }: AchievementsProps) {
	const unlocked = checkAchievements(stats)

	if (unlocked.length === 0) return null

	// Show top 5 achievements by tier (diamond > platinum > gold > silver > bronze)
	const tierOrder = { diamond: 0, platinum: 1, gold: 2, silver: 3, bronze: 4 }
	const sorted = [...unlocked].sort((a, b) => tierOrder[a.tier] - tierOrder[b.tier]).slice(0, 5)

	return (
		<div className="flex flex-wrap gap-2">
			{sorted.map((achievement) => (
				<div
					key={achievement.id}
					className={cn(
						'flex h-8 w-8 items-center justify-center rounded-full',
						TIER_BG_COLORS[achievement.tier],
					)}
					title={`${achievement.name}: ${achievement.description}`}
				>
					<Icon
						icon={achievement.icon}
						aria-hidden="true"
						className={cn('h-4 w-4', TIER_COLORS[achievement.tier])}
					/>
				</div>
			))}
			{unlocked.length > 5 && (
				<div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
					+{unlocked.length - 5}
				</div>
			)}
		</div>
	)
}
