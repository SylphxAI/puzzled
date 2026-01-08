'use client'

import { useCallback, useEffect, useState } from 'react'
import { ONBOARDING_CONFIG } from '@/lib/config/subscription'

const STORAGE_KEY = 'puzzled_onboarding'

type OnboardingState = {
	// First visit tracking
	hasSeenWelcome: boolean
	firstVisitAt: string | null

	// Signup prompts
	gamesCompletedAsGuest: number
	lastSignupPromptAt: string | null
	signupPromptsDismissed: number

	// Premium prompts
	daysActive: number
	lastPremiumPromptAt: string | null
	premiumPromptsDismissed: number

	// Feature discovery
	hasSeenStreakExplainer: boolean
	hasSeenArchiveMode: boolean
}

const DEFAULT_STATE: OnboardingState = {
	hasSeenWelcome: false,
	firstVisitAt: null,
	gamesCompletedAsGuest: 0,
	lastSignupPromptAt: null,
	signupPromptsDismissed: 0,
	daysActive: 0,
	lastPremiumPromptAt: null,
	premiumPromptsDismissed: 0,
	hasSeenStreakExplainer: false,
	hasSeenArchiveMode: false,
}

/**
 * Hook for managing onboarding state in localStorage
 *
 * Tracks:
 * - First visit / welcome modal
 * - Guest → User conversion prompts
 * - User → Premium conversion prompts
 * - Feature discovery states
 */
export function useOnboardingState() {
	const [state, setState] = useState<OnboardingState>(DEFAULT_STATE)
	const [isLoaded, setIsLoaded] = useState(false)

	// Load state from localStorage on mount
	useEffect(() => {
		try {
			const stored = localStorage.getItem(STORAGE_KEY)
			if (stored) {
				const parsed = JSON.parse(stored)
				setState({ ...DEFAULT_STATE, ...parsed })
			} else {
				// First visit - set initial state
				const initialState = {
					...DEFAULT_STATE,
					firstVisitAt: new Date().toISOString(),
				}
				localStorage.setItem(STORAGE_KEY, JSON.stringify(initialState))
				setState(initialState)
			}
		} catch {
			// localStorage not available or parse error
		}
		setIsLoaded(true)
	}, [])

	// Persist state changes
	const updateState = useCallback((updates: Partial<OnboardingState>) => {
		setState((prev) => {
			const newState = { ...prev, ...updates }
			try {
				localStorage.setItem(STORAGE_KEY, JSON.stringify(newState))
			} catch {
				// localStorage not available
			}
			return newState
		})
	}, [])

	// Actions

	const markWelcomeSeen = useCallback(() => {
		updateState({ hasSeenWelcome: true })
	}, [updateState])

	const incrementGuestGames = useCallback(() => {
		updateState({ gamesCompletedAsGuest: state.gamesCompletedAsGuest + 1 })
	}, [state.gamesCompletedAsGuest, updateState])

	const dismissSignupPrompt = useCallback(() => {
		updateState({
			lastSignupPromptAt: new Date().toISOString(),
			signupPromptsDismissed: state.signupPromptsDismissed + 1,
		})
	}, [state.signupPromptsDismissed, updateState])

	const dismissPremiumPrompt = useCallback(() => {
		updateState({
			lastPremiumPromptAt: new Date().toISOString(),
			premiumPromptsDismissed: state.premiumPromptsDismissed + 1,
		})
	}, [state.premiumPromptsDismissed, updateState])

	const markFeatureSeen = useCallback(
		(feature: 'streak' | 'archive') => {
			const key = {
				streak: 'hasSeenStreakExplainer',
				archive: 'hasSeenArchiveMode',
			}[feature] as keyof OnboardingState

			updateState({ [key]: true })
		},
		[updateState],
	)

	const incrementDaysActive = useCallback(() => {
		updateState({ daysActive: state.daysActive + 1 })
	}, [state.daysActive, updateState])

	// Computed values

	const shouldShowWelcome = isLoaded && !state.hasSeenWelcome

	// Show signup prompt after 1st game as guest, but not more than once per day
	const shouldShowSignupPrompt =
		isLoaded &&
		state.gamesCompletedAsGuest >= 1 &&
		state.signupPromptsDismissed < ONBOARDING_CONFIG.SIGNUP_PROMPT_MAX_DISMISSALS &&
		(!state.lastSignupPromptAt ||
			Date.now() - new Date(state.lastSignupPromptAt).getTime() >
				ONBOARDING_CONFIG.SIGNUP_PROMPT_COOLDOWN_DAYS * ONBOARDING_CONFIG.DAY_MS)

	// Show premium prompt after 3+ games as guest, but not more than once per 3 days
	const shouldShowPremiumPrompt =
		isLoaded &&
		state.gamesCompletedAsGuest >= ONBOARDING_CONFIG.GAMES_FOR_PREMIUM_PROMPT &&
		state.premiumPromptsDismissed < ONBOARDING_CONFIG.PREMIUM_PROMPT_MAX_DISMISSALS &&
		(!state.lastPremiumPromptAt ||
			Date.now() - new Date(state.lastPremiumPromptAt).getTime() >
				ONBOARDING_CONFIG.PREMIUM_PROMPT_COOLDOWN_DAYS * ONBOARDING_CONFIG.DAY_MS)

	return {
		state,
		isLoaded,

		// Actions
		markWelcomeSeen,
		incrementGuestGames,
		dismissSignupPrompt,
		dismissPremiumPrompt,
		markFeatureSeen,
		incrementDaysActive,

		// Computed
		shouldShowWelcome,
		shouldShowSignupPrompt,
		shouldShowPremiumPrompt,
	}
}
