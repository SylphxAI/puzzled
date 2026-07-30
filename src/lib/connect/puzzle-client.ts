/**
 * technology-stack-profile: generated PuzzleService client (createClient + transport).
 * Primary product play path under default Connect authority.
 */
import { create } from '@bufbuild/protobuf'
import { type Client, createClient } from '@connectrpc/connect'
import {
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
			input.hasCompleted ?? false,
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
			hasCompleted: input.hasCompleted ?? false,
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
	return c.submitGuess(
		create(SubmitGuessRequestSchema, {
			gameSlug: input.gameSlug.trim(),
			seed: BigInt(Math.trunc(input.seed)),
			difficulty: (input.difficulty ?? 'medium').trim(),
			status: input.status,
			attempts: Math.trunc(input.attempts),
			timeSpentMs: BigInt(Math.trunc(input.timeSpentMs)),
			submissionJson: encodeSubmissionJson(input),
		}),
	)
}
