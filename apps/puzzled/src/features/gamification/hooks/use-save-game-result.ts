'use client'

import { PlatformContext, useSafeStreak, useSafeUser } from '@sylphx/sdk/react'
import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useGameAnalytics } from '@/features/analytics'
import type { PuzzleDifficulty } from '@/games/types'
import { queryKeys, useSaveResult } from '@/lib/api'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

/**
 * Input for saving game results
 *
 * IMPORTANT: No `score` field - score is calculated server-side
 * Client sends submission data, server validates and calculates score
 */
export type GameResultInput = {
	status: 'won' | 'lost'
	attempts: number
	timeSpentMs: number
	mode?: 'daily' | 'archive'
	archiveDate?: string
	puzzleId: string
	/** Difficulty level for games that support it */
	difficulty?: PuzzleDifficulty
	/**
	 * Game-specific submission data for server validation
	 * Each game defines what data it needs:
	 * - Wordle: { guesses: string[] }
	 * - Sudoku: { finalGrid: number[][] }
	 * - Queens: { finalGrid: boolean[][] }
	 * - etc.
	 */
	data: unknown
}

/**
 * Response from saveResult includes server-calculated score
 */
export type SaveResultResponse = {
	success: boolean
	score?: number
	error?: string
}

export function useSaveGameResult(gameSlug: string) {
	const { user } = useSafeUser()
	const [status, setStatus] = useState<SaveStatus>('idle')
	const [error, setError] = useState<string | null>(null)
	const savedRef = useRef(false)
	const { trackGameComplete } = useGameAnalytics()

	// SDK Platform context for leaderboard score submission
	const platformContext = useContext(PlatformContext)

	// SDK streak hook for Platform-managed streak tracking (SSR-safe)
	const { recordActivity, isConfigured: streakConfigured } = useSafeStreak('daily-play', {
		defaults: {
			name: 'Daily Play Streak',
			description: 'Play at least one game daily to maintain your streak',
			frequency: 'daily',
			gracePeriodHours: 12,
		},
	})

	// Save result mutation (uses the hook which handles invalidation)
	const mutation = useSaveResult({
		onSuccess: () => {
			// savedRef.current already set before mutation started (prevents race condition)
			setStatus('saved')
		},
		onError: (err) => {
			// savedRef.current reset in catch block to allow retry
			setStatus('error')
			setError(err instanceof Error ? err.message : 'Failed to save result')
		},
	})

	// Reset saved ref when user changes (user login/logout)
	// This effect intentionally depends on userId to reset state on login/logout
	const userId = user?.id
	// biome-ignore lint/correctness/useExhaustiveDependencies: userId dep is intentional for resetting on auth change
	useEffect(() => {
		savedRef.current = false
		setStatus('idle')
	}, [userId])

	const saveResult = useCallback(
		async (input: GameResultInput): Promise<SaveResultResponse> => {
			// Don't save if not logged in
			if (!userId) {
				return { success: false, error: 'Not logged in' }
			}

			// Don't save twice - set flag BEFORE async operation to prevent race condition
			if (savedRef.current) {
				return { success: false, error: 'Already saved' }
			}
			savedRef.current = true // Lock immediately to prevent concurrent saves

			setStatus('saving')
			setError(null)

			try {
				const response = await mutation.mutateAsync({
					gameSlug,
					status: input.status,
					attempts: input.attempts,
					timeSpentMs: input.timeSpentMs,
					mode: input.mode,
					archiveDate: input.archiveDate,
					puzzleId: input.puzzleId,
					difficulty: input.difficulty,
					data: input.data,
				})

				// Track game completion via SDK analytics
				trackGameComplete({
					game: gameSlug,
					status: input.status,
					attempts: input.attempts,
					timeSpentMs: input.timeSpentMs,
					score: response.score,
					mode: input.mode ?? 'daily',
					difficulty: input.difficulty,
					puzzleId: input.puzzleId,
				})

				// Record streak activity to Platform (only on win, if configured)
				// This syncs Puzzled's play streak to the Platform engagement service
				if (input.status === 'won') {
					if (streakConfigured) {
						try {
							await recordActivity({
								gameSlug,
								score: response.score,
								puzzleId: input.puzzleId,
							})
						} catch {
							// Don't fail the save if streak sync fails
							// Platform will eventually be consistent via next activity
						}
					}

					// Submit score to Platform leaderboards (daily, weekly, all-time)
					// Each game has separate leaderboards for different time periods
					if (platformContext && response.score !== undefined) {
						const gameName = gameSlug.charAt(0).toUpperCase() + gameSlug.slice(1)
						const metadata = {
							puzzleId: input.puzzleId,
							attempts: input.attempts,
							timeSpentMs: input.timeSpentMs,
							mode: input.mode,
							difficulty: input.difficulty,
						}

						// Submit to all three leaderboard periods in parallel
						// Don't await - fire and forget for performance
						Promise.all([
							// Daily leaderboard
							platformContext.submitScore(`puzzled-${gameSlug}-daily`, response.score, metadata, {
								name: `${gameName} Daily`,
								description: `Daily high scores for ${gameName}`,
								sortDirection: 'desc',
								resetPeriod: 'daily',
								aggregation: 'max',
							}),
							// Weekly leaderboard
							platformContext.submitScore(`puzzled-${gameSlug}-weekly`, response.score, metadata, {
								name: `${gameName} Weekly`,
								description: `Weekly high scores for ${gameName}`,
								sortDirection: 'desc',
								resetPeriod: 'weekly',
								aggregation: 'max',
							}),
							// All-time leaderboard
							platformContext.submitScore(`puzzled-${gameSlug}-all`, response.score, metadata, {
								name: `${gameName} All Time`,
								description: `All-time high scores for ${gameName}`,
								sortDirection: 'desc',
								resetPeriod: 'never',
								aggregation: 'max',
							}),
						]).catch(() => {
							// Don't fail the save if leaderboard sync fails
							// Users can still see their score in local stats
						})
					}
				}

				// Return server-calculated score
				return {
					success: response.success,
					score: response.score,
				}
			} catch (err) {
				// On error, allow retry by resetting the flag
				savedRef.current = false
				const errorMessage = err instanceof Error ? err.message : 'Unknown error'
				return { success: false, error: errorMessage }
			}
		},
		[
			userId,
			gameSlug,
			mutation,
			streakConfigured,
			recordActivity,
			trackGameComplete,
			platformContext,
		],
	)

	const reset = useCallback(() => {
		savedRef.current = false
		setStatus('idle')
		setError(null)
		mutation.reset()
	}, [mutation])

	return {
		saveResult,
		reset,
		status,
		error,
		isLoggedIn: !!userId,
		hasSaved: savedRef.current,
		isPending: mutation.isPending,
	}
}
