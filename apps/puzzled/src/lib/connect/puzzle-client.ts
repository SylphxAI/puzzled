/**
 * technology-stack-profile: generated PuzzleService client (createClient + transport).
 * Primary product play path under default Connect authority.
 */
import { create } from '@bufbuild/protobuf'
import { type Client, createClient } from '@connectrpc/connect'
import { IDEMPOTENCY_KEY_HEADER } from '@/lib/idempotency-key'
import {
	CheckGuessRequestSchema,
	GetDailyRequestSchema,
	type GetDailyResponse,
	GetPuzzleRequestSchema,
	type GetPuzzleResponse,
	PuzzleService,
	SubmitGuessRequestSchema,
	type SubmitGuessResponse,
} from '../../gen/connect/puzzled/v1/puzzle_pb'
import {
	encodeSubmissionJson,
	type GetDailyInput,
	type GetPuzzleInput,
	type SubmitGuessInput,
	validateGetDailyInput,
	validateGetPuzzleInput,
	validateSubmitGuessInput,
} from './puzzle-domain'
import { getConnectTransport } from './transport'

export type PuzzleServiceClient = Client<typeof PuzzleService>

export const puzzleQueryKeys = {
	root: ['puzzled', 'v1', 'PuzzleService'] as const,
	getPuzzle: (input: GetPuzzleInput) =>
		[
			...puzzleQueryKeys.root,
			'GetPuzzle',
			input.gameSlug,
			input.seed,
			input.difficulty ?? 'medium',
		] as const,
	getDaily: (input: GetDailyInput) =>
		[
			...puzzleQueryKeys.root,
			'GetDaily',
			input.gameSlug,
			input.difficulty ?? null,
			input.puzzleId ?? null,
		] as const,
}

export function createPuzzleServiceClient(baseUrl?: string): PuzzleServiceClient {
	return createClient(PuzzleService, getConnectTransport(baseUrl))
}

export async function getPuzzle(
	input: GetPuzzleInput,
	client?: PuzzleServiceClient,
): Promise<GetPuzzleResponse> {
	const err = validateGetPuzzleInput(input)
	if (err) throw new Error(err)
	const c = client ?? createPuzzleServiceClient()
	return c.getPuzzle(
		create(GetPuzzleRequestSchema, {
			gameSlug: input.gameSlug.trim(),
			seed: BigInt(Math.trunc(input.seed)),
			difficulty: (input.difficulty ?? 'medium').trim(),
		}),
	)
}

export async function getDaily(
	input: GetDailyInput,
	client?: PuzzleServiceClient,
): Promise<GetDailyResponse> {
	const err = validateGetDailyInput(input)
	if (err) throw new Error(err)
	const c = client ?? createPuzzleServiceClient()
	return c.getDaily(
		create(GetDailyRequestSchema, {
			gameSlug: input.gameSlug.trim(),
			difficulty: (input.difficulty ?? '').trim(),
			puzzleId: input.puzzleId?.trim() || undefined,
			puzzleDate: input.puzzleDate?.trim() || undefined,
		}),
	)
}

export async function submitGuess(
	input: SubmitGuessInput,
	client?: PuzzleServiceClient,
): Promise<SubmitGuessResponse> {
	const err = validateSubmitGuessInput(input)
	if (err) throw new Error(err)
	const c = client ?? createPuzzleServiceClient()
	const idempotencyKey = input.idempotencyKey?.trim()
	return c.submitGuess(
		create(SubmitGuessRequestSchema, {
			gameSlug: input.gameSlug.trim(),
			difficulty: (input.difficulty ?? 'medium').trim(),
			status: input.status,
			attempts: Math.trunc(input.attempts),
			timeSpentMs: BigInt(Math.trunc(input.timeSpentMs)),
			submissionJson: encodeSubmissionJson(input),
			puzzleId: input.puzzleId?.trim() || undefined,
			puzzleDate: input.puzzleDate?.trim() || undefined,
		}),
		idempotencyKey ? { headers: { [IDEMPOTENCY_KEY_HEADER]: idempotencyKey } } : undefined,
	)
}

/**
 * Grade one in-game guess on the server (word-guess, word-groups), so the
 * client never holds the answer. The server caps graded guesses at the game's
 * own limit.
 */
export async function checkGuess(
	input: {
		gameSlug: string
		guess: unknown
		puzzleId?: string
		puzzleDate?: string
		difficulty?: string
	},
	client?: PuzzleServiceClient,
): Promise<unknown> {
	const c = client ?? createPuzzleServiceClient()
	const response = await c.checkGuess(
		create(CheckGuessRequestSchema, {
			gameSlug: input.gameSlug.trim(),
			difficulty: (input.difficulty ?? '').trim(),
			puzzleId: input.puzzleId?.trim() || undefined,
			puzzleDate: input.puzzleDate?.trim() || undefined,
			guessJson: JSON.stringify(input.guess),
		}),
	)
	return JSON.parse(response.resultJson)
}
