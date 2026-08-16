'use client'

import { useCallback, useEffect, useState } from 'react'
import { canonicalizeGameSlug } from '@/lib/game-slug'
import { productDayKey } from '@/lib/product-day'
import { GUEST_GAMES_KEY } from '@/lib/storage-keys'
import {
	cleanGuestCompletions,
	type GuestCompletedGame,
	type GuestGameStore,
	normalizeGuestGameStore,
	summarizeGuestCompletions,
} from '../lib/guest-day-summary'

function loadGuestStore(): GuestGameStore {
	if (typeof window === 'undefined') {
		return { version: 2, games: [] }
	}

	try {
		const stored = localStorage.getItem(GUEST_GAMES_KEY)
		return normalizeGuestGameStore(stored ? JSON.parse(stored) : null)
	} catch {
		return { version: 2, games: [] }
	}
}

function saveGuestStore(store: GuestGameStore): void {
	if (typeof window === 'undefined') return

	try {
		localStorage.setItem(GUEST_GAMES_KEY, JSON.stringify(store))
	} catch {
		// localStorage not available or full
	}
}

function cleanOldEntries(games: GuestCompletedGame[]): GuestCompletedGame[] {
	return cleanGuestCompletions(games)
}

/**
 * Hook for managing guest (non-logged-in) user game state
 * Stores game completions in localStorage for 7 days
 */
export function useGuestGameState(gameSlug: string) {
	const canonicalSlug = canonicalizeGameSlug(gameSlug)
	const [store, setStore] = useState<GuestGameStore>({ version: 2, games: [] })
	const [isLoaded, setIsLoaded] = useState(false)

	// Load store on mount
	useEffect(() => {
		const loaded = loadGuestStore()
		// Clean old entries on load
		const cleaned = {
			...loaded,
			games: cleanOldEntries(loaded.games),
		}
		setStore(cleaned)
		saveGuestStore(cleaned)
		setIsLoaded(true)
	}, [])

	// Check if user has completed today's puzzle for this game
	const hasCompletedToday = useCallback(() => {
		const today = productDayKey()
		return store.games.some((g) => g.gameSlug === canonicalSlug && g.date === today)
	}, [store.games, canonicalSlug])

	// Get today's completed session if exists
	const getTodaySession = useCallback((): GuestCompletedGame | null => {
		const today = productDayKey()
		return store.games.find((g) => g.gameSlug === canonicalSlug && g.date === today) ?? null
	}, [store.games, canonicalSlug])

	// Save a completed game
	const saveCompletion = useCallback(
		(result: { status: 'won' | 'lost'; attempts: number; score?: number }): void => {
			const today = productDayKey()

			// Don't save if already completed today
			if (hasCompletedToday()) {
				return
			}

			const newGame: GuestCompletedGame = {
				gameSlug: canonicalSlug,
				date: today,
				status: result.status,
				attempts: result.attempts,
				score: result.score,
				completedAt: new Date().toISOString(),
			}

			const newStore: GuestGameStore = {
				...store,
				games: cleanOldEntries([...store.games, newGame]),
			}

			setStore(newStore)
			saveGuestStore(newStore)
		},
		[canonicalSlug, store, hasCompletedToday],
	)

	// Get all games completed on a specific date
	const getGamesForDate = useCallback(
		(dateString: string): GuestCompletedGame[] => {
			return store.games.filter((g) => g.date === dateString)
		},
		[store.games],
	)

	// Clear all guest data (for migration when user signs up)
	const clearAllData = useCallback(() => {
		const emptyStore: GuestGameStore = { version: 2, games: [] }
		setStore(emptyStore)
		saveGuestStore(emptyStore)
	}, [])

	// Export data for migration to logged-in state
	const exportData = useCallback((): GuestCompletedGame[] => {
		return [...store.games]
	}, [store.games])

	return {
		isLoaded,
		hasCompletedToday: hasCompletedToday(),
		todaySession: getTodaySession(),
		currentStreak: summarizeGuestCompletions(store.games).currentStreak,
		saveCompletion,
		getGamesForDate,
		clearAllData,
		exportData,
	}
}

/**
 * Guest-facing day/module projection for the home ritual entry.
 * It is derived from local records written only after server acceptance.
 */
export function useGuestDailySummary() {
	const [store, setStore] = useState<GuestGameStore>({ version: 2, games: [] })
	const [isLoaded, setIsLoaded] = useState(false)

	useEffect(() => {
		const loaded = loadGuestStore()
		const cleaned = { ...loaded, games: cleanOldEntries(loaded.games) }
		setStore(cleaned)
		saveGuestStore(cleaned)
		setIsLoaded(true)
	}, [])

	return { isLoaded, ...summarizeGuestCompletions(store.games) }
}
