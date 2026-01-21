'use client'

import { createContext, useCallback, useContext, useState } from 'react'
import { triggerHaptic, triggerSound } from '@/shared/hooks'
import type { Achievement } from '../lib/achievements'
import { AchievementToast } from './achievement-toast'

type AchievementContextValue = {
	/** Show an achievement toast */
	showAchievement: (achievement: Achievement, onShare?: () => void) => void
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
 *
 * Note: SDK tracks unlock state server-side via useAchievements().
 * This provider only handles toast display - no localStorage tracking needed.
 */
export function AchievementToastProvider({ children }: Props) {
	const [currentAchievement, setCurrentAchievement] = useState<Achievement | null>(null)
	const [onShare, setOnShare] = useState<(() => void) | undefined>(undefined)

	// Show an achievement toast
	const showAchievement = useCallback((achievement: Achievement, shareHandler?: () => void) => {
		triggerSound('achievement')
		triggerHaptic('achievement')
		setCurrentAchievement(achievement)
		setOnShare(() => shareHandler)
	}, [])

	const handleClose = useCallback(() => {
		setCurrentAchievement(null)
		setOnShare(undefined)
	}, [])

	return (
		<AchievementContext.Provider value={{ showAchievement }}>
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
