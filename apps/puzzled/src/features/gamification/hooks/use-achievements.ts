'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { triggerHaptic, triggerSound } from '@/shared/hooks'
import type { Achievement, UserAchievement } from '../lib/achievements'
import { ACHIEVEMENTS, checkAchievements } from '../lib/achievements'

const SEEN_ACHIEVEMENTS_KEY = 'puzzled_seen_achievements'

type AchievementStats = {
	totalWins: number
	maxStreak: number
	wordleWins: number
	connectionsWins: number
	wordleBestAttempts?: number
	connectionsPerfectGames?: number
}

/**
 * Hook to manage achievement tracking and new unlock detection
 *
 * Tracks which achievements have been "seen" (toasted) in localStorage
 * to avoid showing the same achievement toast multiple times.
 */
export function useAchievements() {
	const [newAchievement, setNewAchievement] = useState<Achievement | null>(null)
	const [seenAchievements, setSeenAchievements] = useState<Set<string>>(new Set())
	const initialized = useRef(false)

	// Load seen achievements from localStorage on mount
	useEffect(() => {
		if (initialized.current) return
		initialized.current = true

		try {
			const stored = localStorage.getItem(SEEN_ACHIEVEMENTS_KEY)
			if (stored) {
				const parsed = JSON.parse(stored) as string[]
				setSeenAchievements(new Set(parsed))
			}
		} catch {
			// Ignore parse errors
		}
	}, [])

	// Save seen achievements to localStorage
	const markAsSeen = useCallback((achievementIds: string[]) => {
		setSeenAchievements((prev) => {
			const updated = new Set(prev)
			for (const id of achievementIds) {
				updated.add(id)
			}
			try {
				localStorage.setItem(SEEN_ACHIEVEMENTS_KEY, JSON.stringify([...updated]))
			} catch {
				// Ignore storage errors
			}
			return updated
		})
	}, [])

	/**
	 * Check for new achievements based on stats
	 * Returns the first new (unseen) achievement, or null if none
	 */
	const checkNewAchievements = useCallback(
		(stats: AchievementStats): UserAchievement | null => {
			const unlocked = checkAchievements(stats)

			// Find first achievement that hasn't been seen
			for (const achievement of unlocked) {
				if (!seenAchievements.has(achievement.id)) {
					return achievement
				}
			}

			return null
		},
		[seenAchievements],
	)

	/**
	 * Trigger achievement unlock with toast and feedback
	 */
	const unlockAchievement = useCallback(
		(achievement: Achievement) => {
			// Mark as seen immediately to prevent duplicate toasts
			markAsSeen([achievement.id])

			// Trigger feedback
			triggerSound('achievement')
			triggerHaptic('achievement')

			// Show toast
			setNewAchievement(achievement)
		},
		[markAsSeen],
	)

	/**
	 * Dismiss the current achievement toast
	 */
	const dismissAchievement = useCallback(() => {
		setNewAchievement(null)
	}, [])

	/**
	 * Check stats and show toast for any new achievement
	 * Call this after game completion
	 */
	const checkAndUnlock = useCallback(
		(stats: AchievementStats) => {
			const newAch = checkNewAchievements(stats)
			if (newAch) {
				// Small delay to let celebration play first
				setTimeout(() => unlockAchievement(newAch), 1500)
			}
		},
		[checkNewAchievements, unlockAchievement],
	)

	/**
	 * Get all unlocked achievements for display
	 */
	const getUnlockedAchievements = useCallback((stats: AchievementStats): UserAchievement[] => {
		return checkAchievements(stats)
	}, [])

	/**
	 * Get all achievements with unlock status
	 */
	const getAllAchievements = useCallback(
		(stats: AchievementStats): (Achievement & { unlocked: boolean })[] => {
			const unlocked = checkAchievements(stats)
			const unlockedIds = new Set(unlocked.map((a) => a.id))

			return ACHIEVEMENTS.map((achievement) => ({
				...achievement,
				unlocked: unlockedIds.has(achievement.id),
			}))
		},
		[],
	)

	return {
		newAchievement,
		dismissAchievement,
		checkAndUnlock,
		getUnlockedAchievements,
		getAllAchievements,
		markAsSeen,
	}
}
