import { afterEach, describe, expect, test } from 'bun:test'
import { create } from '@bufbuild/protobuf'
import { createClient } from '@connectrpc/connect'
import { createConnectTransport } from '@connectrpc/connect-web'
import { createPuzzleFixtureServer } from '../scripts/serve-puzzle-fixture'
import { parseWordSearchClientPayload } from '../src/games/word-search/parse-client'
import { GetDailyRequestSchema, PuzzleService } from '../src/gen/connect/puzzled/v1/puzzle_pb'

let server: ReturnType<typeof createPuzzleFixtureServer> | undefined
afterEach(() => {
	server?.stop(true)
	server = undefined
})

function fixture() {
	server = createPuzzleFixtureServer(0)
	const baseUrl = `http://127.0.0.1:${server.port}`
	return {
		baseUrl,
		client: createClient(
			PuzzleService,
			createConnectTransport({ baseUrl, useBinaryFormat: false }),
		),
		post(body: unknown) {
			return fetch(`${baseUrl}/puzzled.v1.PuzzleService/GetDaily`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', 'connect-protocol-version': '1' },
				body: JSON.stringify(body),
			})
		},
	}
}

describe('deterministic GetDaily fixture API', () => {
	test('the generated Connect client receives real frozen boards', async () => {
		const { baseUrl, client } = fixture()
		for (const slug of ['word-search', 'arithmo']) {
			const body = await client.getDaily(create(GetDailyRequestSchema, { gameSlug: slug }))
			expect(body.gameSlug).toBe(slug)
			expect(body.canPlay).toBe(true)
			expect(body.mode).toBe('daily')
			expect(body.stub).toBe(false)
			expect(body.puzzleDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
			expect(body.puzzleDataJson.length).toBeGreaterThan(10)
			expect(body.puzzleDataJson).not.toContain('solution')
			if (slug === 'word-search') {
				const board = parseWordSearchClientPayload(JSON.parse(body.puzzleDataJson))
				expect(board.words.length).toBeGreaterThan(0)
				expect(JSON.stringify(board)).not.toContain('placements')
			}
		}
		const health = await fetch(`${baseUrl}/healthz`)
		expect(await health.text()).toBe('ok')
	})

	test('a missing slug fails closed instead of inventing a board', async () => {
		const { post } = fixture()
		const response = await post({ difficulty: '' })
		expect(response.status).toBe(400)
		expect(await response.json()).toEqual({
			code: 'invalid_argument',
			message: 'game_slug_required',
		})
	})

	test('an unknown game or invalid difficulty fails closed', async () => {
		const { post } = fixture()
		expect((await post({ gameSlug: 'not-a-game' })).status).toBe(404)
		expect((await post({ gameSlug: 'word-search', difficulty: 'impossible' })).status).toBe(400)
	})

	test('the RPC does not accept a query-string GET', async () => {
		const { baseUrl } = fixture()
		const response = await fetch(
			`${baseUrl}/puzzled.v1.PuzzleService/GetDaily?gameSlug=word-search`,
		)
		expect(response.status).toBe(405)
	})
})
