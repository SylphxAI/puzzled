'use client'

import { useEffect, useRef } from 'react'
import { useSafeUser, useAchievements, useStreak } from '@sylphx/sdk/react'
import { trpc } from '@/trpc'
import { ACHIEVEMENTS } from '../lib/achievements'
import { useAchievementToast } from './achievement-toast-provider'

const CHECK_INTERVAL_MS = 5000 // Don't check more than once per 5 seconds

/**
 * Component that checks for new achievements after game completions
 * Uses SDK's useAchievements and useStreak hooks for Platform-managed tracking.
 * Mount this once in the layout to enable achievement toasts.
 */
export function AchievementChecker() {
	const { user } = useSafeUser()
	const { showAchievement } = useAchievementToast()
	const lastCheck = useRef<number>(0)
	const hasChecked = useRef(false)

	// SDK achievements hook - tracks state server-side
	const {
		achievements: sdkAchievements,
		unlock,
		recentUnlock,
		dismissRecentUnlock,
		isLoading: achievementsLoading,
	} = useAchievements()

	// SDK streak hook - Platform-managed streak tracking
	const { longest: maxStreak, isLoading: streakLoading } = useStreak('daily-play', {
		name: 'Daily Play Streak',
		description: 'Play at least one game daily to maintain your streak',
		frequency: 'daily',
		gracePeriodHours: 12,
	})

	// Fetch per-game stats (still from local tRPC - game stats are Puzzled-specific)
	const { data: userStats } = trpc.stats.getUserStats.useQuery(undefined, {
		enabled: !!user,
		staleTime: 10000,
	})

	// Show toast when SDK reports a recent unlock
	useEffect(() => {
		if (recentUnlock) {
			// Find local achievement definition for rich display data
			const localDef = ACHIEVEMENTS.find((a) => a.id === recentUnlock.achievement.id)
			if (localDef) {
				showAchievement(localDef)
			}
			dismissRecentUnlock()
		}
	}, [recentUnlock, showAchievement, dismissRecentUnlock])

	// Check for new achievements when stats update
	useEffect(() => {
		if (!user || !userStats || achievementsLoading || streakLoading) return

		// Throttle checks
		const now = Date.now()
		if (now - lastCheck.current < CHECK_INTERVAL_MS) return
		lastCheck.current = now

		// Prevent checking on initial load
		if (!hasChecked.current) {
			hasChecked.current = true
			return
		}

		// Build set of already unlocked achievement IDs
		const unlockedIds = new Set(
			sdkAchievements.filter((a) => a.unlocked).map((a) => a.achievementId)
		)

		// Calculate stats
		const totalWins = (userStats.wordle?.gamesWon ?? 0) + (userStats.connections?.gamesWon ?? 0)

		// Get best attempts from guess distribution
		const wordleDistribution = userStats.wordle?.guessDistribution as
			| Record<string, number>
			| null
			| undefined
		const wordleBestAttempts = wordleDistribution
			? Math.min(
					...Object.keys(wordleDistribution)
						.map(Number)
						.filter((n) => n > 0),
				)
			: undefined

		const wordleWins = userStats.wordle?.gamesWon ?? 0
		const connectionsWins = userStats.connections?.gamesWon ?? 0
		const connectionsPerfectGames = userStats.connections?.perfectGames ?? undefined

		// Check and unlock achievements via SDK
		const checkAndUnlock = async (
			id: string,
			condition: boolean,
			localDef: (typeof ACHIEVEMENTS)[number]
		) => {
			if (condition && !unlockedIds.has(id)) {
				await unlock(id, {
					name: localDef.name,
					description: localDef.description,
					points: getTierPoints(localDef.tier),
					tier: localDef.tier,
					icon: localDef.icon,
				})
			}
		}

		// Streak achievements
		const streak3 = ACHIEVEMENTS.find((a) => a.id === 'streak-3')!
		const streak7 = ACHIEVEMENTS.find((a) => a.id === 'streak-7')!
		const streak30 = ACHIEVEMENTS.find((a) => a.id === 'streak-30')!
		const streak100 = ACHIEVEMENTS.find((a) => a.id === 'streak-100')!

		checkAndUnlock('streak-3', maxStreak >= 3, streak3)
		checkAndUnlock('streak-7', maxStreak >= 7, streak7)
		checkAndUnlock('streak-30', maxStreak >= 30, streak30)
		checkAndUnlock('streak-100', maxStreak >= 100, streak100)

		// Win count achievements
		const wins10 = ACHIEVEMENTS.find((a) => a.id === 'wins-10')!
		const wins50 = ACHIEVEMENTS.find((a) => a.id === 'wins-50')!
		const wins100 = ACHIEVEMENTS.find((a) => a.id === 'wins-100')!
		const wins500 = ACHIEVEMENTS.find((a) => a.id === 'wins-500')!

		checkAndUnlock('wins-10', totalWins >= 10, wins10)
		checkAndUnlock('wins-50', totalWins >= 50, wins50)
		checkAndUnlock('wins-100', totalWins >= 100, wins100)
		checkAndUnlock('wins-500', totalWins >= 500, wins500)

		// Special achievements
		const wordlePerfect = ACHIEVEMENTS.find((a) => a.id === 'wordle-perfect')!
		const wordleFast = ACHIEVEMENTS.find((a) => a.id === 'wordle-fast')!
		const connectionsPerfect = ACHIEVEMENTS.find((a) => a.id === 'connections-perfect')!
		const allGames = ACHIEVEMENTS.find((a) => a.id === 'all-games')!

		checkAndUnlock(
			'wordle-perfect',
			wordleBestAttempts === 1,
			wordlePerfect
		)
		checkAndUnlock(
			'wordle-fast',
			wordleBestAttempts !== undefined && wordleBestAttempts <= 2,
			wordleFast
		)
		checkAndUnlock(
			'connections-perfect',
			connectionsPerfectGames !== undefined && connectionsPerfectGames > 0,
			connectionsPerfect
		)
		checkAndUnlock(
			'all-games',
			wordleWins > 0 && connectionsWins > 0,
			allGames
		)
	}, [user, userStats, achievementsLoading, streakLoading, maxStreak, sdkAchievements, unlock])

	return null
}

// Helper to convert tier to points
function getTierPoints(tier: string): number {
	switch (tier) {
		case 'bronze':
			return 10
		case 'silver':
			return 25
		case 'gold':
			return 50
		case 'platinum':
			return 100
		case 'diamond':
			return 250
		default:
			return 10
	}
}
