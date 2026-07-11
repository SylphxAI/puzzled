/**
 * Puzzles Routes — ADR-168 S2 thin proxy to Rust authority.
 *
 * - GET /grid → Rust GET /api/v1/puzzles/grid (prod ingress or dev flag)
 * - POST /submit → Rust POST /api/v1/puzzles/submit (prod ingress or dev flag)
 */

import { OpenAPIHono } from '@hono/zod-openapi'
import {
	proxyToRustApi,
	shouldProxyPuzzleGridToRust,
	shouldProxyPuzzleSubmitToRust,
} from '../../rust-api-proxy'
import type { PuzzledEnv } from '../types'

const puzzlesRoutes = new OpenAPIHono<PuzzledEnv>()
	.get('/grid', async (c) => {
		if (shouldProxyPuzzleGridToRust()) {
			return proxyToRustApi(c.req.raw)
		}
		return c.json(
			{
				error: 'Puzzle grid generation requires Rust API authority',
				hint: 'Set PUZZLED_USE_RUST_PUZZLE_GRID=1 or configure API_INTERNAL_URL',
				slice: 'S2-puzzle-grid',
			},
			503,
		)
	})
	.post('/submit', async (c) => {
		if (shouldProxyPuzzleSubmitToRust()) {
			return proxyToRustApi(c.req.raw)
		}
		return c.json(
			{
				error: 'Puzzle solution submit requires Rust API authority',
				hint: 'Set PUZZLED_USE_RUST_PUZZLE_SUBMIT=1 or configure API_INTERNAL_URL',
				slice: 'S2-puzzle-solution-submit',
			},
			503,
		)
	})

export { puzzlesRoutes }
export type PuzzlesRoutes = typeof puzzlesRoutes
