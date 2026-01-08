'use client'

import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'puzzled_guest_games'
const RETENTION_DAYS = 7

type GuestCompletedGame = {
	gameSlug: string
	date: string // YYYY-MM-DD
	status: 'won' | 'lost'
	attempts: number
	score?: number
	completedAt: string // ISO string
}

type GuestGameStore = {
	version: 1
	games: GuestCompletedGame[]
}

function getTodayDateString(): string {
	const now = new Date()
	return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
		.toISOString()
		.split('T')[0]
}

function loadGuestStore(): GuestGameStore {
	if (typeof window === 'undefined') {
		return { version: 1, games: [] }
	}

	try {
		const stored = localStorage.getItem(STORAGE_KEY)
		if (!stored) {
			return { version: 1, games: [] }
		}
		const parsed = JSON.parse(stored) as GuestGameStore
		return parsed
	} catch {
		return { version: 1, games: [] }
	}
}

function saveGuestStore(store: GuestGameStore): void {
	if (typeof window === 'undefined') return

	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
	} catch {
		// localStorage not available or full
	}
}

function cleanOldEntries(games: GuestCompletedGame[]): GuestCompletedGame[] {
	const cutoffDate = new Date()
	cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS)
	const cutoffStr = cutoffDate.toISOString().split('T')[0]

	return games.filter((game) => game.date >= cutoffStr)
}

/**
 * Hook for managing guest (non-logged-in) user game state
 * Stores game completions in localStorage for 7 days
 */
export function useGuestGameState(gameSlug: string) {
	const [store, setStore] = useState<GuestGameStore>({ version: 1, games: [] })
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
		const today = getTodayDateString()
		return store.games.some((g) => g.gameSlug === gameSlug && g.date === today)
	}, [store.games, gameSlug])

	// Get today's completed session if exists
	const getTodaySession = useCallback((): GuestCompletedGame | null => {
		const today = getTodayDateString()
		return store.games.find((g) => g.gameSlug === gameSlug && g.date === today) ?? null
	}, [store.games, gameSlug])

	// Save a completed game
	const saveCompletion = useCallback(
		(result: { status: 'won' | 'lost'; attempts: number; score?: number }): void => {
			const today = getTodayDateString()

			// Don't save if already completed today
			if (hasCompletedToday()) {
				return
			}

			const newGame: GuestCompletedGame = {
				gameSlug,
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
		[gameSlug, store, hasCompletedToday],
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
		const emptyStore: GuestGameStore = { version: 1, games: [] }
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
		saveCompletion,
		getGamesForDate,
		clearAllData,
		exportData,
	}
}

/**
 * Hook to check guest completion status for all games
 * Used on home page to show completion indicators
 */
export function useGuestCompletionStatus() {
	const [completions, setCompletions] = useState<Record<string, GuestCompletedGame>>({})
	const [isLoaded, setIsLoaded] = useState(false)

	useEffect(() => {
		const store = loadGuestStore()
		const today = getTodayDateString()

		const todaysGames: Record<string, GuestCompletedGame> = {}
		for (const game of store.games) {
			if (game.date === today) {
				todaysGames[game.gameSlug] = game
			}
		}

		setCompletions(todaysGames)
		setIsLoaded(true)
	}, [])

	const isCompleted = useCallback(
		(gameSlug: string): boolean => {
			return gameSlug in completions
		},
		[completions],
	)

	const getCompletion = useCallback(
		(gameSlug: string): GuestCompletedGame | null => {
			return completions[gameSlug] ?? null
		},
		[completions],
	)

	return {
		isLoaded,
		isCompleted,
		getCompletion,
		completions,
	}
}
