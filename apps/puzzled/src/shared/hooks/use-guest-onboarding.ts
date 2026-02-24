/**
 * Guest Onboarding State Hook
 *
 * Tracks guest game progress and shows signup prompts after
 * a certain number of games played.
 */

'use client'

import { useCallback, useEffect, useState } from 'react'
import { GUEST_ONBOARDING_KEY } from '@/lib/storage-keys'

const GAMES_BEFORE_PROMPT = 3

interface OnboardingState {
	gamesPlayed: number
	promptDismissed: boolean
}

function getStoredState(): OnboardingState {
	if (typeof window === 'undefined') {
		return { gamesPlayed: 0, promptDismissed: false }
	}

	try {
		const stored = localStorage.getItem(GUEST_ONBOARDING_KEY)
		if (stored) {
			return JSON.parse(stored)
		}
	} catch {
		// Ignore parse errors
	}

	return { gamesPlayed: 0, promptDismissed: false }
}

function saveState(state: OnboardingState): void {
	if (typeof window === 'undefined') return

	try {
		localStorage.setItem(GUEST_ONBOARDING_KEY, JSON.stringify(state))
	} catch {
		// Ignore storage errors
	}
}

export function useGuestOnboarding() {
	const [state, setState] = useState<OnboardingState>(getStoredState)

	// Load from localStorage on mount
	useEffect(() => {
		setState(getStoredState())
	}, [])

	const incrementGuestGames = useCallback(() => {
		setState((prev) => {
			const next = { ...prev, gamesPlayed: prev.gamesPlayed + 1 }
			saveState(next)
			return next
		})
	}, [])

	const dismissSignupPrompt = useCallback(() => {
		setState((prev) => {
			const next = { ...prev, promptDismissed: true }
			saveState(next)
			return next
		})
	}, [])

	const shouldShowSignupPrompt = !state.promptDismissed && state.gamesPlayed >= GAMES_BEFORE_PROMPT

	return {
		gamesPlayed: state.gamesPlayed,
		shouldShowSignupPrompt,
		incrementGuestGames,
		dismissSignupPrompt,
	}
}
