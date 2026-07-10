/**
 * Internal Rust API client for delegated authority calls (ADR-168 S2).
 */

import type { GameResult, GameSubmission } from '@/games/types'
import { resolveRustApiBaseUrl, shouldProxyPuzzleSubmitToRust } from './rust-api-proxy'

type ValidateAndScoreInput = {
	gameSlug: string
	solution: unknown
	puzzleData: unknown
	submission: GameSubmission
}

/** True when save-result validation should delegate to Rust scoring authority. */
export function shouldDelegateScoringToRust(): boolean {
	return shouldProxyPuzzleSubmitToRust()
}

/**
 * Validate and score a puzzle submission via Rust POST /api/v1/puzzles/submit.
 */
export async function validateAndScoreViaRust(
	input: ValidateAndScoreInput,
): Promise<GameResult> {
	const url = `${resolveRustApiBaseUrl()}/api/v1/puzzles/submit`
	const response = await fetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			gameSlug: input.gameSlug,
			solution: input.solution,
			puzzleData: input.puzzleData,
			submission: input.submission,
		}),
	})

	if (!response.ok) {
		const detail = await response.text().catch(() => response.statusText)
		return {
			valid: false,
			error: `Rust scoring authority error (${response.status}): ${detail}`,
		}
	}

	const body = (await response.json()) as GameResult & { slice?: string }
	if (body.valid) {
		return { valid: true, status: body.status, score: body.score }
	}
	return { valid: false, error: body.error ?? 'Invalid game result' }
}