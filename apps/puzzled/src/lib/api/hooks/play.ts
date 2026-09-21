'use client'

/**
 * Puzzled API hooks - Play domain (sole Connect authority, ADR-170).
 */

import {
	type UseMutationOptions,
	type UseQueryOptions,
	useMutation,
	useQuery,
	useQueryClient,
} from '@tanstack/react-query'
import { isAlreadyPlayedError } from '@/lib/connect/already-played'
import { admitGetDailyViaConnect, admitSubmitGuessViaConnect } from '@/lib/connect/puzzle-admission'
import { servedPuzzleId } from '@/lib/product-day'
import { ApiError, queryKeys } from './shared'

// ==========================================
// Play (sole Connect)
// ==========================================

export function useDailyStatus(
	gameSlug: string,
	difficulty?: string,
	options?: Omit<UseQueryOptions<unknown, ApiError>, 'queryKey' | 'queryFn'>,
) {
	return useQuery({
		queryKey: queryKeys.dailyStatus(gameSlug, difficulty),
		queryFn: async () => {
			const admit = await admitGetDailyViaConnect({ gameSlug, difficulty })
			if (admit.ok) {
				const r = admit.response
				return {
					hasCompleted: r.hasCompleted,
					completedSession: r.hasCompleted ? { status: 'won', stub: true } : null,
					puzzle: {
						id: servedPuzzleId(r.puzzleId) || '',
						puzzleNumber: r.puzzleNumber,
						puzzleDate: r.puzzleDate,
						puzzleData: r.puzzleDataJson
							? (() => {
									try {
										return JSON.parse(r.puzzleDataJson)
									} catch {
										return null
									}
								})()
							: null,
						difficulty: r.difficulty || difficulty || null,
					},
					canPlay: r.canPlay,
					mode: r.mode || 'daily',
					slice: r.slice || 'S2-daily-connect',
					authority: 'connect' as const,
				}
			}
			throw new ApiError(503, admit.error || 'connect_play_fail_closed', {
				code: 'CONNECT_PLAY_FAIL_CLOSED',
				message: admit.error || 'connect_play_fail_closed',
			})
		},
		...options,
	})
}

export function useTodaysPuzzle(
	gameSlug: string,
	difficulty?: string,
	options?: Omit<UseQueryOptions<unknown, ApiError>, 'queryKey' | 'queryFn'>,
) {
	return useQuery({
		queryKey: queryKeys.todaysPuzzle(gameSlug, difficulty),
		queryFn: async () => {
			const admit = await admitGetDailyViaConnect({ gameSlug, difficulty })
			if (admit.ok) {
				const r = admit.response
				return {
					puzzleId: servedPuzzleId(r.puzzleId) || '',
					puzzleNumber: r.puzzleNumber,
					puzzleDate: r.puzzleDate,
					puzzleData: r.puzzleDataJson
						? (() => {
								try {
									return JSON.parse(r.puzzleDataJson)
								} catch {
									return null
								}
							})()
						: null,
					difficulty: r.difficulty || difficulty || null,
					slice: r.slice || 'S2-daily-connect',
					stub: r.stub,
					authority: 'connect' as const,
				}
			}
			throw new ApiError(503, admit.error || 'connect_play_fail_closed', {
				code: 'CONNECT_PLAY_FAIL_CLOSED',
				message: admit.error || 'connect_play_fail_closed',
			})
		},
		...options,
	})
}

export type SaveResultInput = {
	status: 'won' | 'lost'
	attempts: number
	timeSpentMs: number
	mode?: 'daily' | 'archive'
	archiveDate?: string
	puzzleId?: string
	puzzleDate?: string
	puzzleNumber?: number
	difficulty?: string
	gameSlug: string
	data?: unknown
}

export type SaveResultOutput = {
	success: boolean
	score?: number
	session?: unknown
	mode: string
	slice: string
	authority: 'connect'
	error?: string
}

export function useSaveResult(
	options?: Omit<
		UseMutationOptions<SaveResultOutput, ApiError, SaveResultInput, unknown>,
		'mutationFn' | 'onSuccess'
	> & {
		onSuccess?: (data: SaveResultOutput, variables: SaveResultInput) => void
	},
) {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (input: SaveResultInput) => {
			// Sole Connect authority: PuzzleService.SubmitGuess. No REST fallback.
			if (input.status !== 'won' && input.status !== 'lost') {
				throw new ApiError(400, 'status_required_won_or_lost', {
					code: 'CONNECT_SUBMIT_STATUS',
					message: 'status_required_won_or_lost',
				})
			}
			const admit = await admitSubmitGuessViaConnect({
				gameSlug: input.gameSlug,
				difficulty: input.difficulty,
				status: input.status,
				attempts: input.attempts,
				timeSpentMs: input.timeSpentMs,
				submission: input.data,
				puzzleId: servedPuzzleId(input.puzzleId),
				puzzleDate: input.mode === 'archive' ? input.archiveDate : input.puzzleDate || undefined,
			})
			if (admit.ok) {
				const r = admit.response
				return {
					success: r.valid,
					score: r.score,
					session: undefined,
					mode: input.mode ?? 'daily',
					slice: r.slice || 'S2-puzzle-solution-connect',
					authority: 'connect' as const,
					error: r.error,
				}
			}
			if (isAlreadyPlayedError(admit.error)) {
				return {
					success: true,
					session: undefined,
					mode: input.mode ?? 'daily',
					slice: 'S2-puzzle-solution-connect',
					authority: 'connect' as const,
					error: 'already_played',
				}
			}
			throw new ApiError(503, admit.error || 'connect_play_fail_closed', {
				code: 'CONNECT_PLAY_FAIL_CLOSED',
				message: admit.error || 'connect_play_fail_closed',
			})
		},
		onSuccess: (data, variables) => {
			queryClient.invalidateQueries({ queryKey: queryKeys.userStats() })
			queryClient.invalidateQueries({ queryKey: queryKeys.streakInfo() })
			queryClient.invalidateQueries({ queryKey: queryKeys.todayCompletions() })
			queryClient.invalidateQueries({
				queryKey: queryKeys.dailyStatus(variables.gameSlug, variables.difficulty),
			})
			options?.onSuccess?.(data, variables)
		},
		...options,
	})
}
