'use client'

import { useEffect, useRef } from 'react'
import { useSafeUser } from '@sylphx/sdk/react'
import { trpc } from '@/trpc'
import { checkAchievements } from '../lib/achievements'
import { useAchievementToast } from './achievement-toast-provider'

const LAST_CHECK_KEY = 'puzzled_achievement_last_check'
const CHECK_INTERVAL_MS = 5000 // Don't check more than once per 5 seconds

/**
 * Component that checks for new achievements after game completions
 * Mount this once in the layout to enable achievement toasts
 * Gracefully handles when Sylphx Platform is not configured.
 */
export function AchievementChecker() {
	const { user } = useSafeUser()
	const { checkAndShowNewAchievement } = useAchievementToast()
	const lastCheck = useRef<number>(0)
	const hasChecked = useRef(false)

	// Fetch user stats for achievement checking
	const { data: streakInfo } = trpc.gamification.getStreakInfo.useQuery(undefined, {
		enabled: !!user,
		staleTime: 10000,
	})

	// Fetch per-game stats
	const { data: userStats } = trpc.stats.getUserStats.useQuery(undefined, {
		enabled: !!user,
		staleTime: 10000,
	})

	// Check for new achievements when stats update
	useEffect(() => {
		if (!user || !streakInfo || !userStats) return

		// Throttle checks
		const now = Date.now()
		if (now - lastCheck.current < CHECK_INTERVAL_MS) return
		lastCheck.current = now

		// Prevent double-checking on initial load (only check on updates)
		if (!hasChecked.current) {
			// Mark last check time from localStorage to prevent toasts on page refresh
			const storedLastCheck = localStorage.getItem(LAST_CHECK_KEY)
			if (storedLastCheck) {
				const lastCheckTime = parseInt(storedLastCheck, 10)
				// If we checked recently, skip
				if (now - lastCheckTime < 60000) {
					hasChecked.current = true
					return
				}
			}
		}

		hasChecked.current = true
		localStorage.setItem(LAST_CHECK_KEY, now.toString())

		// Calculate total wins
		const totalWins = (userStats.wordle?.gamesWon ?? 0) + (userStats.connections?.gamesWon ?? 0)

		// Get best attempts from guess distribution if available
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

		const achievementStats = {
			totalWins,
			maxStreak: streakInfo.maxStreak ?? 0,
			wordleWins: userStats.wordle?.gamesWon ?? 0,
			connectionsWins: userStats.connections?.gamesWon ?? 0,
			wordleBestAttempts:
				wordleBestAttempts === Number.POSITIVE_INFINITY ? undefined : wordleBestAttempts,
			connectionsPerfectGames: userStats.connections?.perfectGames ?? undefined,
		}

		// Check and show new achievements
		const unlocked = checkAchievements(achievementStats)
		if (unlocked.length > 0) {
			checkAndShowNewAchievement(unlocked)
		}
	}, [user, streakInfo, userStats, checkAndShowNewAchievement])

	return null
}
