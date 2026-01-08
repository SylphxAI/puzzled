'use client'

import { useEffect, useRef } from 'react'

const STORAGE_KEY = 'puzzled_guest_games'
const MIGRATION_FLAG = 'puzzled_guest_migrated'

type GuestCompletedGame = {
	gameSlug: string
	date: string
	status: 'won' | 'lost'
	attempts: number
	score?: number
	completedAt: string
}

type GuestGameStore = {
	version: 1
	games: GuestCompletedGame[]
}

/**
 * Hook to migrate guest game data to server after login
 * Should be used in a component that renders when user is authenticated
 */
export function useGuestDataMigration(userId: string | undefined) {
	const hasMigrated = useRef(false)

	useEffect(() => {
		// Only run once per mount and only if user is logged in
		if (!userId || hasMigrated.current) return

		// Check if already migrated this session
		const migrationFlag = sessionStorage.getItem(MIGRATION_FLAG)
		if (migrationFlag === userId) {
			hasMigrated.current = true
			return
		}

		// Load guest data from localStorage
		const stored = localStorage.getItem(STORAGE_KEY)
		if (!stored) {
			// No guest data to migrate
			sessionStorage.setItem(MIGRATION_FLAG, userId)
			hasMigrated.current = true
			return
		}

		let guestStore: GuestGameStore
		try {
			guestStore = JSON.parse(stored) as GuestGameStore
		} catch (error) {
			// Invalid JSON in guest data - log for debugging and clear it
			console.warn('[GuestMigration] Invalid guest data format, clearing:', error)
			localStorage.removeItem(STORAGE_KEY)
			sessionStorage.setItem(MIGRATION_FLAG, userId)
			hasMigrated.current = true
			return
		}

		if (!guestStore.games || guestStore.games.length === 0) {
			// No games to migrate
			sessionStorage.setItem(MIGRATION_FLAG, userId)
			hasMigrated.current = true
			return
		}

		// Migrate guest data to server
		hasMigrated.current = true
		migrateGuestData(guestStore.games, userId)
	}, [userId])
}

async function migrateGuestData(games: GuestCompletedGame[], userId: string) {
	try {
		const response = await fetch('/api/auth/migrate-guest-data', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ games }),
		})

		if (response.ok) {
			const result = await response.json()
			console.log(`[GuestMigration] Successfully migrated ${result.migrated} games`)

			// Clear guest data after successful migration
			localStorage.removeItem(STORAGE_KEY)
			sessionStorage.setItem(MIGRATION_FLAG, userId)
		} else {
			console.error('[GuestMigration] Migration failed:', await response.text())
		}
	} catch (error) {
		console.error('[GuestMigration] Error during migration:', error)
	}
}
