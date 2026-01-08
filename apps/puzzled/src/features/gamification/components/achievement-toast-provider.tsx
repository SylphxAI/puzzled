'use client'

import { createContext, useCallback, useContext, useState } from 'react'
import { triggerHaptic, triggerSound } from '@/shared/hooks'
import type { Achievement } from '../lib/achievements'
import { AchievementToast } from './achievement-toast'

const SEEN_ACHIEVEMENTS_KEY = 'puzzled_seen_achievements'

type AchievementContextValue = {
	showAchievement: (achievement: Achievement) => void
	checkAndShowNewAchievement: (
		achievements: Achievement[],
		onShare?: () => void,
	) => Achievement | null
}

const AchievementContext = createContext<AchievementContextValue | null>(null)

export function useAchievementToast() {
	const context = useContext(AchievementContext)
	if (!context) {
		throw new Error('useAchievementToast must be used within AchievementToastProvider')
	}
	return context
}

type Props = {
	children: React.ReactNode
}

/**
 * Provider for achievement toasts
 * Tracks seen achievements in localStorage and shows toasts for new ones
 */
export function AchievementToastProvider({ children }: Props) {
	const [currentAchievement, setCurrentAchievement] = useState<Achievement | null>(null)
	const [onShare, setOnShare] = useState<(() => void) | undefined>(undefined)

	// Get seen achievements from localStorage
	const getSeenAchievements = useCallback((): Set<string> => {
		try {
			const stored = localStorage.getItem(SEEN_ACHIEVEMENTS_KEY)
			if (stored) {
				return new Set(JSON.parse(stored) as string[])
			}
		} catch {
			// Ignore parse errors
		}
		return new Set()
	}, [])

	// Mark achievement as seen
	const markAsSeen = useCallback(
		(achievementId: string) => {
			try {
				const seen = getSeenAchievements()
				seen.add(achievementId)
				localStorage.setItem(SEEN_ACHIEVEMENTS_KEY, JSON.stringify([...seen]))
			} catch {
				// Ignore storage errors
			}
		},
		[getSeenAchievements],
	)

	// Show an achievement toast
	const showAchievement = useCallback(
		(achievement: Achievement, shareHandler?: () => void) => {
			markAsSeen(achievement.id)
			triggerSound('achievement')
			triggerHaptic('achievement')
			setCurrentAchievement(achievement)
			setOnShare(() => shareHandler)
		},
		[markAsSeen],
	)

	// Check for new achievements and show toast for first new one
	const checkAndShowNewAchievement = useCallback(
		(achievements: Achievement[], shareHandler?: () => void): Achievement | null => {
			const seen = getSeenAchievements()

			for (const achievement of achievements) {
				if (!seen.has(achievement.id)) {
					// Delay to let game celebration play first
					setTimeout(() => showAchievement(achievement, shareHandler), 1500)
					return achievement
				}
			}

			return null
		},
		[getSeenAchievements, showAchievement],
	)

	const handleClose = useCallback(() => {
		setCurrentAchievement(null)
		setOnShare(undefined)
	}, [])

	return (
		<AchievementContext.Provider value={{ showAchievement, checkAndShowNewAchievement }}>
			{children}
			{currentAchievement && (
				<AchievementToast
					achievement={{
						id: currentAchievement.id,
						name: currentAchievement.name,
						description: currentAchievement.description,
						icon: currentAchievement.icon,
					}}
					open={true}
					onClose={handleClose}
					onShare={onShare}
				/>
			)}
		</AchievementContext.Provider>
	)
}
