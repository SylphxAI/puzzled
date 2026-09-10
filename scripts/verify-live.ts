#!/usr/bin/env bun

/**
 * verify-live.ts — re-runnable Live-layer readbacks for the Puzzled capability
 * graph (PUZ-MODULE / PUZ-DAILY / PUZ-FREE / PUZ-SHARE / PUZ-PLUS / PUZ-MARKS).
 *
 * Layer: Live (docs/north-star/EVIDENCE-AND-ORACLES.md §1) for the revision the
 * target itself reports. Source/CI/Deploy layers are NOT established here, and
 * a green-looking proxy never upgrades a check.
 *
 * Every check reports pass / fail / unknown together with the raw evidence that
 * supports it (HTTP status, timing, response excerpts, SHA-256 fingerprints and
 * the git_commit_sha the target reports on /healthz).
 *
 * Read-only by default. `--play` performs one genuine terminal submission plus
 * the one-finish-per-(user, module, product day) re-submit probe; that writes a
 * guest session row on the target (production for puzzled.gg). Use a fresh
 * `--guest` per run — the default is a new random UUID, printed in the output.
 *
 * Usage:
 *   bun scripts/verify-live.ts                                  # read-only, live
 *   bun scripts/verify-live.ts --base https://puzzled.gg --json
 *   bun scripts/verify-live.ts --play --guest <uuid>            # writes one finish
 *   bun scripts/verify-live.ts --base https://example.com --json
 */

import type { IncomingHttpHeaders } from 'node:http'
import { createServer } from 'node:http'

// ---------------------------------------------------------------------------
// Constants (contracts this harness asserts against)
// ---------------------------------------------------------------------------

const DEFAULT_BASE = 'https://puzzled.gg'
const DEFAULT_TIMEOUT_MS = 20_000
/** Hard cap on any response body read (defensive; product pages are ~150 KB). */
const MAX_BODY_BYTES = 4 * 1024 * 1024
const CONNECT_PREFIX = '/puzzled.v1.PuzzleService'

/** Premium-free daily rotation (crates/puzzled-core …/game_slugs.rs FREE_GAME_ROTATION). */
const FREE_ROTATION = ['word-guess', 'word-groups', 'crowns', 'sudoku', 'crossword'] as const

/**
 * Keys the server must never expose on GetDaily/GetPuzzle
 * (crates/puzzled-core …/crossword_generate.rs CLIENT_LEAK_KEYS).
 */
const CLIENT_LEAK_KEYS = new Set([
	'answer',
	'answers',
	'solution',
	'solution_json',
	'solutionjson',
	'word',
	'queens',
])

/**
 * CATALOG §3.2 marks we do not use (player title or slug). The harness scans
 * served HTML for them: title / meta / JSON-LD / manifest fields hard-fail,
 * anywhere else warns with the exact context.
 */
const FORBIDDEN_MARKS: ReadonlyArray<{ mark: string; pattern: RegExp }> = [
	{ mark: 'Wordle', pattern: /\bwordle\b/ },
	{ mark: 'Connections', pattern: /\bconnections\b/ },
	{ mark: 'Strands', pattern: /\bstrands\b/ },
	{ mark: 'Spelling Bee', pattern: /\bspelling\s+bee\b/ },
	{ mark: 'Letter Boxed', pattern: /\bletter[\s-]+boxed\b/ },
	{ mark: 'Pips', pattern: /\bpips\b/ },
	{ mark: 'The Mini', pattern: /\bthe\s+mini\b/ },
	{ mark: 'The Midi', pattern: /\bthe\s+midi\b/ },
	{ mark: 'Crossplay', pattern: /\bcrossplay\b/ },
	{ mark: 'Queens', pattern: /\bqueens\b/ },
	{ mark: 'Tango', pattern: /\btango\b/ },
	{ mark: 'Zip', pattern: /\bzip\b/ },
	{ mark: 'Pinpoint', pattern: /\bpinpoint\b/ },
	{ mark: 'Crossclimb', pattern: /\bcrossclimb\b/ },
	{ mark: 'Wend', pattern: /\bwend\b/ },
	{ mark: 'Patches', pattern: /\bpatches\b/ },
	{ mark: 'KenKen/Ken-Ken', pattern: /\bken-?ken\b/ },
	{ mark: 'KenDoku', pattern: /\bkendoku\b/ },
	{ mark: 'Picross', pattern: /\bpicross\b/ },
	{ mark: 'Hidato', pattern: /\bhidato\b/ },
	{ mark: 'Numbrix', pattern: /\bnumbrix\b/ },
	{ mark: 'Scrabble', pattern: /\bscrabble\b/ },
	{ mark: 'Words with Friends', pattern: /\bwords\s+with\s+friends\b/ },
	{ mark: 'Heardle', pattern: /\bheardle\b/ },
	{ mark: 'Wordl (misspelling)', pattern: /\bwordl\b/ },
	{ mark: 'Connexions (misspelling)', pattern: /\bconnexions\b/ },
]

const LOCALHOST_RE = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/i

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CheckStatus = 'pass' | 'fail' | 'unknown'

type SubResult = {
	id: string
	status: CheckStatus
	detail: string
}

type Check = {
	id: string
	title: string
	status: CheckStatus
	required: boolean
	unknownReason: 'not_attempted' | 'indeterminate' | null
	summary: string
	sub: SubResult[]
	evidence: Record<string, unknown>
}

type Options = {
	base: string
	play: boolean
	guest: string
	guestProvided: boolean
	json: boolean
	timeoutMs: number
	expectedSha: string | null
	selfTest: boolean
}

type HttpResult = {
	url: string
	method: string
	httpStatus: number | null
	timeMs: number
	contentType: string | null
	bodyBytes: number
	bodyText: string
	bodyJson: unknown
	bodyJsonError: string | null
	bodySha256: string | null
	bodySha256Scope: 'full' | 'truncated'
	bodyTruncated: boolean
	maxBodyBytes: number
	location: string | null
	middlewareRewrite: string | null
	error: string | null
}

type ConnectResult = HttpResult & {
	connectCode: string | null
	connectMessage: string | null
}

type TerminalPlan = {
	kind: 'win' | 'honest-loss'
	status: 'won' | 'lost'
	data: Record<string, unknown>
	solver: Record<string, unknown>
	/** Strings whose presence in a landing payload means the solution leaked. */
	solutionSignatures: string[]
}

type Report = {
	base: string
	observedAt: string
	liveRevision: string | null
	expectedRevision: string | null
	productDayKey: string
	productDayKeySource: string
	mode: 'read-only' | 'play (writes one guest finish)'
	guestId: string
	ok: boolean
	summary: {
		pass: number
		fail: number
		unknown: number
		notAttempted: number
		indeterminate: number
	}
	checks: Check[]
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

function printHelp(): void {
	console.log(`verify-live — Puzzled live capability readbacks (Bun + fetch, no deps)

Usage: bun scripts/verify-live.ts [options]

Options:
  --base <url>      target base URL (default ${DEFAULT_BASE})
  --play            perform the finish-loop write check (writes ONE guest
                    session row on the target; default is read-only)
  --guest <uuid>    stable guest UUID for the run (default: fresh random UUID)
  --expected-sha <sha>
                    assert the /healthz git_commit_sha (prefix match either
                    direction). Default is a pure readback: without this flag
                    the expected revision is unknown and not asserted.
  --json            print only the stable JSON report on stdout (no human lines)
  --self-test       run the synthetic stub scenarios (F1/F2/F3 regression proof)
                    and exit 0 only when every scenario behaves as expected
  --timeout <ms>    per-request timeout (default ${DEFAULT_TIMEOUT_MS})
  -h, --help        show this help

Exit code: 1 when any required check fails, or when an indeterminate unknown
remains; 0 otherwise. Read-only mode reports the finish loop as
unknown/not_attempted and does not fail the run for it.

Evidence layer: Live (observed behavior of the target's own reported revision).
`)
}

function parseOptions(argv: string[]): Options | 'help' | { error: string } {
	const opts: Options = {
		base: DEFAULT_BASE,
		play: false,
		guest: crypto.randomUUID(),
		guestProvided: false,
		json: false,
		timeoutMs: DEFAULT_TIMEOUT_MS,
		expectedSha: null,
		selfTest: false,
	}
	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i]
		switch (arg) {
			case '-h':
			case '--help':
				return 'help'
			case '--play':
				opts.play = true
				break
			case '--json':
				opts.json = true
				break
			case '--self-test':
				opts.selfTest = true
				break
			case '--base': {
				const value = argv[i + 1]
				if (!value) return { error: '--base requires a URL' }
				opts.base = value.replace(/\/+$/, '')
				i += 1
				break
			}
			case '--expected-sha': {
				const value = argv[i + 1]
				if (!value) return { error: '--expected-sha requires a commit SHA' }
				const trimmed = value.trim().toLowerCase()
				if (!/^[0-9a-f]{7,40}$/.test(trimmed)) {
					return { error: `--expected-sha must be 7-40 hex characters: ${value}` }
				}
				opts.expectedSha = trimmed
				i += 1
				break
			}
			case '--guest': {
				const value = argv[i + 1]
				if (!value) return { error: '--guest requires a UUID' }
				opts.guest = value.trim().replace(/^guest_/, '')
				opts.guestProvided = true
				i += 1
				break
			}
			case '--timeout': {
				const value = Number(argv[i + 1])
				if (!Number.isFinite(value) || value <= 0) return { error: '--timeout requires ms' }
				opts.timeoutMs = Math.trunc(value)
				i += 1
				break
			}
			default:
				return { error: `unknown argument: ${arg}` }
		}
	}
	if (!/^https?:\/\/[^/]+/i.test(opts.base)) {
		return { error: `--base must be an absolute http(s) URL: ${opts.base}` }
	}
	if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(opts.guest)) {
		return { error: `--guest must be a UUID (8-4-4-4-12 hex): ${opts.guest}` }
	}
	return opts
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/**
 * Product day key: calendar date in Asia/Hong_Kong. Hong Kong is fixed UTC+8
 * (no DST), which is exactly the server's `product_day_key` shift
 * (crates/puzzled-core …/daily_time.rs).
 */
export function productDayKey(instant: Date = new Date()): string {
	return new Date(instant.getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10)
}

function shiftDayKey(dayKey: string, deltaDays: number): string {
	const date = new Date(`${dayKey}T00:00:00.000Z`)
	date.setUTCDate(date.getUTCDate() + deltaDays)
	return date.toISOString().slice(0, 10)
}

function isDayKey(value: unknown): value is string {
	return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function excerpt(text: string, max = 420): string {
	const collapsed = text.replace(/\s+/g, ' ').trim()
	return collapsed.length <= max ? collapsed : `${collapsed.slice(0, max)}…`
}

function contextAround(text: string, index: number, matchLength: number, radius = 70): string {
	const start = Math.max(0, index - radius)
	const end = Math.min(text.length, index + matchLength + radius)
	const prefix = start > 0 ? '…' : ''
	const suffix = end < text.length ? '…' : ''
	return `${prefix}${text.slice(start, end).replace(/\s+/g, ' ')}${suffix}`
}

async function sha256Hex(text: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
	return Array.from(new Uint8Array(digest))
		.map((byte) => byte.toString(16).padStart(2, '0'))
		.join('')
}

function safeJsonParse(text: string): { value: unknown; error: string | null } {
	try {
		return { value: JSON.parse(text) as unknown, error: null }
	} catch (error) {
		return { value: null, error: error instanceof Error ? error.message : String(error) }
	}
}

function hostOf(base: string): string {
	try {
		return new URL(base).hostname
	} catch {
		return ''
	}
}

function isLocalHostname(host: string): boolean {
	return (
		host === 'localhost' ||
		host === '127.0.0.1' ||
		host === '::1' ||
		host.endsWith('.localhost') ||
		host.endsWith('.local')
	)
}

function combine(sub: SubResult[]): CheckStatus {
	if (sub.some((entry) => entry.status === 'fail')) return 'fail'
	if (sub.some((entry) => entry.status === 'unknown')) return 'unknown'
	return 'pass'
}

/**
 * Normalize the check verdict before the run-level rollup (reviewer F1).
 *
 * An `unknown` check is run-failing unless it explicitly labels itself
 * `not_attempted` (only the read-only finish loop does). A check that went
 * unknown because evidence was missing is `indeterminate`, so `ok`/exit can
 * never depend on a check forgetting its label.
 */
function finalizeCheck(check: Check): Check {
	if (check.status !== 'unknown') return { ...check, unknownReason: null }
	return {
		...check,
		unknownReason: check.unknownReason === 'not_attempted' ? 'not_attempted' : 'indeterminate',
	}
}

function sub(id: string, status: CheckStatus, detail: string): SubResult {
	return { id, status, detail }
}

function asRecord(value: unknown): Record<string, unknown> | null {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null
}

function asString(value: unknown): string | null {
	return typeof value === 'string' ? value : null
}

// ---------------------------------------------------------------------------
// HTTP + Connect
// ---------------------------------------------------------------------------

async function httpRequest(
	url: string,
	init: RequestInit & { timeoutMs: number },
): Promise<HttpResult> {
	const started = performance.now()
	const headers = new Headers(init.headers)
	if (!headers.has('accept')) headers.set('accept', '*/*')
	if (!headers.has('user-agent')) {
		headers.set('user-agent', 'puzzled-verify-live/1 (SylphxAI/puzzled scripts/verify-live.ts)')
	}
	const method = (init.method ?? 'GET').toUpperCase()
	try {
		const response = await fetch(url, {
			...init,
			method,
			headers,
			signal: AbortSignal.timeout(init.timeoutMs),
		})
		const contentType = response.headers.get('content-type')
		// Bound the body: a hostile or misbehaving --base must not be able to
		// force unbounded memory before excerpt() truncates for display.
		const { text: bodyText, truncated: bodyTruncated } = await readBoundedBody(
			response,
			MAX_BODY_BYTES,
		)
		const { value, error } = safeJsonParse(bodyText)
		return {
			url,
			method,
			httpStatus: response.status,
			timeMs: Math.round(performance.now() - started),
			contentType,
			bodyBytes: new TextEncoder().encode(bodyText).length,
			bodyText,
			bodyJson: value,
			bodyJsonError: error,
			bodySha256: await sha256Hex(bodyText),
			bodySha256Scope: bodyTruncated ? 'truncated' : 'full',
			bodyTruncated,
			maxBodyBytes: MAX_BODY_BYTES,
			location: response.headers.get('location'),
			middlewareRewrite: response.headers.get('x-middleware-rewrite'),
			error: null,
		}
	} catch (error) {
		return {
			url,
			method,
			httpStatus: null,
			timeMs: Math.round(performance.now() - started),
			contentType: null,
			bodyBytes: 0,
			bodyText: '',
			bodyJson: null,
			bodyJsonError: null,
			bodySha256: null,
			bodySha256Scope: 'full',
			bodyTruncated: false,
			maxBodyBytes: MAX_BODY_BYTES,
			location: null,
			middlewareRewrite: null,
			error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
		}
	}
}

/** Read at most `maxBytes` of the response body; report whether it was cut. */
async function readBoundedBody(
	response: Response,
	maxBytes: number,
): Promise<{ text: string; truncated: boolean }> {
	const reader = response.body?.getReader()
	if (!reader) {
		const text = await response.text()
		if (text.length > maxBytes) return { text: text.slice(0, maxBytes), truncated: true }
		return { text, truncated: false }
	}
	const chunks: Uint8Array[] = []
	let received = 0
	let truncated = false
	while (true) {
		const { done, value } = await reader.read()
		if (done) break
		if (!value) continue
		received += value.byteLength
		if (received > maxBytes) {
			const keep = value.byteLength - (received - maxBytes)
			if (keep > 0) chunks.push(value.subarray(0, keep))
			truncated = true
			await reader.cancel().catch(() => {})
			break
		}
		chunks.push(value)
	}
	const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0)
	const merged = new Uint8Array(total)
	let offset = 0
	for (const chunk of chunks) {
		merged.set(chunk, offset)
		offset += chunk.byteLength
	}
	return { text: new TextDecoder().decode(merged), truncated }
}

function httpEvidence(result: HttpResult): Record<string, unknown> {
	return {
		url: result.url,
		method: result.method,
		httpStatus: result.httpStatus,
		timeMs: result.timeMs,
		contentType: result.contentType,
		bodyBytes: result.bodyBytes,
		maxBodyBytes: result.maxBodyBytes,
		bodyTruncated: result.bodyTruncated,
		bodySha256: result.bodySha256,
		bodySha256Scope: result.bodySha256Scope,
		bodyExcerpt: excerpt(result.bodyText),
		middlewareRewrite: result.middlewareRewrite,
		error: result.error,
	}
}

async function connectUnary(
	base: string,
	method: string,
	body: Record<string, unknown>,
	options: { guestId?: string | null; timeoutMs: number },
): Promise<ConnectResult> {
	const headers: Record<string, string> = {
		'content-type': 'application/json',
		'connect-protocol-version': '1',
		accept: 'application/json',
	}
	if (options.guestId) headers['x-puzzled-guest-id'] = options.guestId
	const result = await httpRequest(`${base}${CONNECT_PREFIX}/${method}`, {
		method: 'POST',
		headers,
		body: JSON.stringify(body),
		timeoutMs: options.timeoutMs,
	})
	const errorBody = asRecord(result.bodyJson)
	return {
		...result,
		connectCode: errorBody ? asString(errorBody.code) : null,
		connectMessage: errorBody ? asString(errorBody.message) : null,
	}
}

function connectEvidence(result: ConnectResult): Record<string, unknown> {
	return {
		...httpEvidence(result),
		connectCode: result.connectCode,
		connectMessage: result.connectMessage,
	}
}

// ---------------------------------------------------------------------------
// Solver / terminal plan (used by --play only)
// ---------------------------------------------------------------------------

/** Backtracking sudoku solver: returns up to `limit` complete grids (0 = empty). */
export function solveSudokuCells(grid: number[][], limit: number): number[][][] {
	const work = grid.map((row) => row.slice())
	const solutions: number[][][] = []

	const candidatesFor = (row: number, col: number): number[] => {
		const used = new Set<number>()
		for (let i = 0; i < 9; i += 1) {
			used.add(work[row][i])
			used.add(work[i][col])
		}
		const boxRow = row - (row % 3)
		const boxCol = col - (col % 3)
		for (let dr = 0; dr < 3; dr += 1) {
			for (let dc = 0; dc < 3; dc += 1) used.add(work[boxRow + dr][boxCol + dc])
		}
		const candidates: number[] = []
		for (let value = 1; value <= 9; value += 1) {
			if (!used.has(value)) candidates.push(value)
		}
		return candidates
	}

	const recurse = (): void => {
		if (solutions.length >= limit) return
		let bestRow = -1
		let bestCol = -1
		let bestCandidates: number[] = []
		for (let row = 0; row < 9; row += 1) {
			for (let col = 0; col < 9; col += 1) {
				if (work[row][col] !== 0) continue
				const candidates = candidatesFor(row, col)
				if (candidates.length === 0) return
				if (bestRow === -1 || candidates.length < bestCandidates.length) {
					bestRow = row
					bestCol = col
					bestCandidates = candidates
					if (candidates.length === 1) break
				}
			}
			if (bestCandidates.length === 1) break
		}
		if (bestRow === -1) {
			solutions.push(work.map((row) => row.slice()))
			return
		}
		for (const value of bestCandidates) {
			work[bestRow][bestCol] = value
			recurse()
			work[bestRow][bestCol] = 0
			if (solutions.length >= limit) return
		}
	}

	recurse()
	return solutions
}

/** Backtracking crowns solver: returns up to `limit` column-per-row solutions. */
export function solveCrowns(regions: number[][], size: number, limit: number): number[][] {
	const solutions: number[][] = []
	const chosen: number[] = new Array(size).fill(-1)
	const usedCols: boolean[] = new Array(size).fill(false)
	const usedRegions = new Set<number>()

	const recurse = (row: number): void => {
		if (solutions.length >= limit) return
		if (row === size) {
			solutions.push(chosen.slice())
			return
		}
		for (let col = 0; col < size; col += 1) {
			if (usedCols[col]) continue
			if (row > 0 && Math.abs(chosen[row - 1] - col) <= 1) continue
			const region = regions[row]?.[col]
			if (region === undefined || region === null) continue
			if (usedRegions.has(region)) continue
			chosen[row] = col
			usedCols[col] = true
			usedRegions.add(region)
			recurse(row + 1)
			usedRegions.delete(region)
			usedCols[col] = false
			chosen[row] = -1
			if (solutions.length >= limit) return
		}
	}

	recurse(0)
	return solutions
}

export function buildSudokuPlan(puzzleData: unknown): TerminalPlan | null {
	const grid = asRecord(puzzleData)?.grid
	if (!Array.isArray(grid) || grid.length !== 9) return null
	const cells: number[][] = []
	for (const row of grid) {
		if (!Array.isArray(row) || row.length !== 9) return null
		const parsedRow: number[] = []
		for (const cell of row) {
			if (cell === null || cell === undefined) {
				parsedRow.push(0)
			} else if (typeof cell === 'number' && Number.isInteger(cell) && cell >= 1 && cell <= 9) {
				parsedRow.push(cell)
			} else {
				return null
			}
		}
		cells.push(parsedRow)
	}
	const emptyCount = cells.flat().filter((value) => value === 0).length
	const sudokuSignatures = (grid: number[][]): string[] => [
		grid.map((row) => row.join('')).join(''),
		JSON.stringify(grid),
	]
	if (emptyCount === 0) {
		return {
			kind: 'win',
			status: 'won',
			data: { finalGrid: cells, mistakes: 0 },
			solver: { kind: 'none', reason: 'served grid is already complete' },
			solutionSignatures: sudokuSignatures(cells),
		}
	}
	const solutions = solveSudokuCells(cells, 2)
	if (solutions.length === 1) {
		return {
			kind: 'win',
			status: 'won',
			data: { finalGrid: solutions[0], mistakes: 0 },
			solver: {
				kind: 'sudoku-backtracking',
				solutionCountUpTo2: 1,
				emptyCells: emptyCount,
			},
			solutionSignatures: sudokuSignatures(solutions[0]),
		}
	}
	// Non-unique (or unsolved) puzzle: the server's stored solution cannot be
	// determined from the served data, so an honest loss is the terminal.
	return {
		kind: 'honest-loss',
		status: 'lost',
		data: { finalGrid: cells.map((row) => row.map((value) => (value === 0 ? null : value))) },
		solver: {
			kind: 'sudoku-backtracking',
			solutionCountUpTo2: solutions.length,
			emptyCells: emptyCount,
			reason:
				solutions.length === 0
					? 'served grid has no completion found by the harness solver'
					: 'served grid has ≥2 valid completions; server solution not determinable from served data',
		},
		solutionSignatures: [],
	}
}

export function buildCrownsPlan(puzzleData: unknown): TerminalPlan | null {
	const record = asRecord(puzzleData)
	const size = record?.size
	const regions = record?.regions
	if (typeof size !== 'number' || !Array.isArray(regions)) return null
	if (!Number.isInteger(size) || size < 1 || size > 12) return null
	const parsedRegions: number[][] = []
	for (const row of regions) {
		if (!Array.isArray(row) || row.length !== size) return null
		const parsedRow: number[] = []
		for (const cell of row) {
			if (typeof cell !== 'number' || !Number.isInteger(cell)) return null
			parsedRow.push(cell)
		}
		parsedRegions.push(parsedRow)
	}
	if (parsedRegions.length !== size) return null
	const solutions = solveCrowns(parsedRegions, size, 2)
	const toGrid = (columns: number[]): boolean[][] =>
		Array.from({ length: size }, (_, row) =>
			Array.from({ length: size }, (_, col) => columns[row] === col),
		)
	if (solutions.length === 1) {
		const grid = toGrid(solutions[0])
		return {
			kind: 'win',
			status: 'won',
			data: { finalGrid: grid },
			solver: { kind: 'crowns-backtracking', solutionCountUpTo2: 1, size },
			solutionSignatures: [
				JSON.stringify(grid),
				JSON.stringify(grid.map((row) => row.map((cell) => (cell ? 1 : 0)))),
			],
		}
	}
	return {
		kind: 'honest-loss',
		status: 'lost',
		data: { finalGrid: Array.from({ length: size }, () => new Array(size).fill(false)) },
		solver: {
			kind: 'crowns-backtracking',
			solutionCountUpTo2: solutions.length,
			size,
			reason:
				solutions.length === 0
					? 'no completion found by the harness solver'
					: 'served regions have ≥2 valid completions; server solution not determinable from served data',
		},
		solutionSignatures: [],
	}
}

/**
 * Terminal plan for the free module. Solutions are never served, so only
 * modules whose served data fully determines the answer are solved (sudoku,
 * crowns); everything else submits an honest `lost` terminal.
 */
export function buildTerminalPlan(slug: string, puzzleData: unknown): TerminalPlan | null {
	switch (slug) {
		case 'sudoku':
			return buildSudokuPlan(puzzleData)
		case 'crowns':
			return buildCrownsPlan(puzzleData)
		case 'word-guess':
			return {
				kind: 'honest-loss',
				status: 'lost',
				data: { guesses: ['CRANE'] },
				solver: {
					kind: 'none',
					reason: 'solution word never served; honest lost terminal with one non-winning guess',
				},
				solutionSignatures: [],
			}
		case 'word-groups':
			return {
				kind: 'honest-loss',
				status: 'lost',
				data: { foundCategories: [], mistakes: 0 },
				solver: {
					kind: 'none',
					reason: 'category solution never served; honest lost terminal with no found categories',
				},
				solutionSignatures: [],
			}
		case 'crossword':
			return {
				kind: 'honest-loss',
				status: 'lost',
				data: { finalGrid: buildEmptyStringGrid(puzzleData) },
				solver: {
					kind: 'none',
					reason: 'clue answers never served; honest lost terminal with an empty grid',
				},
				solutionSignatures: [],
			}
		default:
			return null
	}
}

function buildEmptyStringGrid(puzzleData: unknown): (string | null)[][] {
	const grid = asRecord(puzzleData)?.grid
	const rows = Array.isArray(grid) ? grid.length : 5
	const cols = Array.isArray(grid) && Array.isArray(grid[0]) ? (grid[0] as unknown[]).length : 5
	return Array.from({ length: rows }, () => new Array(cols).fill(null))
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

/**
 * Revision assertion: with `--expected-sha` set the reported `git_commit_sha`
 * must match (prefix match either direction, so short SHAs work); without the
 * flag the expected revision is unknown and stays a pure readback.
 */
function shaMatches(actual: string, expected: string): boolean {
	const a = actual.trim().toLowerCase()
	const e = expected.trim().toLowerCase()
	return a === e || a.startsWith(e) || e.startsWith(a)
}

async function checkHealthz(
	base: string,
	timeoutMs: number,
	expectedSha: string | null,
): Promise<Check> {
	const result = await httpRequest(`${base}/healthz`, { timeoutMs })
	const body = asRecord(result.bodyJson)
	const sha = asString(body?.git_commit_sha)
	const bodyStatus = asString(body?.status)
	const subResults: SubResult[] = [
		sub(
			'http-200',
			result.httpStatus === 200 ? 'pass' : result.httpStatus === null ? 'unknown' : 'fail',
			`GET /healthz → ${result.httpStatus ?? result.error} in ${result.timeMs}ms`,
		),
		sub(
			'api-health-shape',
			body && bodyStatus === 'ok'
				? 'pass'
				: result.httpStatus === null || result.bodyJsonError
					? 'unknown'
					: 'fail',
			body
				? `health body status=${bodyStatus ?? 'missing'} (expected the api health document, status "ok")`
				: `health body is not the api JSON health document: ${excerpt(result.bodyText, 120)}`,
		),
		sub(
			'git-commit-sha',
			sha ? 'pass' : result.bodyJsonError || result.httpStatus === null ? 'unknown' : 'fail',
			sha
				? `git_commit_sha=${sha}`
				: `git_commit_sha missing (body: ${excerpt(result.bodyText, 120)})`,
		),
	]
	if (expectedSha) {
		const matches = sha ? shaMatches(sha, expectedSha) : false
		subResults.push(
			sub(
				'expected-revision',
				matches ? 'pass' : 'fail',
				matches
					? `git_commit_sha=${sha} matches --expected-sha ${expectedSha}`
					: `git_commit_sha=${sha ?? 'missing'} does NOT match --expected-sha ${expectedSha}`,
			),
		)
	}
	const revisionExpectation = expectedSha
		? `asserted: ${expectedSha}`
		: 'unknown (no --expected-sha; pure readback)'
	return {
		id: 'healthz',
		title: 'api liveness + deployed revision identity',
		status: combine(subResults),
		required: true,
		unknownReason: null,
		summary: `GET /healthz → ${result.httpStatus ?? 'no response'}; git_commit_sha=${sha ?? 'missing'}${
			expectedSha
				? sha && shaMatches(sha, expectedSha)
					? ` (matches --expected-sha ${expectedSha})`
					: ` (MISMATCH vs --expected-sha ${expectedSha})`
				: ' (readback only)'
		}`,
		sub: subResults,
		evidence: {
			...httpEvidence(result),
			gitCommitSha: sha,
			expectedSha,
			revisionExpectation,
		},
	}
}

async function checkReadyz(
	base: string,
	liveSha: string | null,
	timeoutMs: number,
): Promise<Check> {
	const result = await httpRequest(`${base}/readyz`, { timeoutMs })
	const body = asRecord(result.bodyJson)
	const dependencies = Array.isArray(body?.dependencies) ? (body?.dependencies as unknown[]) : null
	const dependencyStates = (dependencies ?? []).map((entry) => {
		const record = asRecord(entry)
		return {
			name: asString(record?.name),
			ok: typeof record?.ok === 'boolean' ? record.ok : null,
			required: typeof record?.required === 'boolean' ? record.required : null,
			detail: asString(record?.detail),
		}
	})
	// Fail closed: only an explicit `required: false` exempts a dependency.
	const requiredUnhealthy = dependencyStates.filter(
		(entry) => entry.required !== false && entry.ok !== true,
	)
	const stubValue = typeof body?.stub === 'boolean' ? String(body.stub) : 'absent(false)'
	const bodySha = asString(body?.git_commit_sha)
	const subResults: SubResult[] = [
		sub(
			'http-200',
			result.httpStatus === 200 ? 'pass' : result.httpStatus === null ? 'unknown' : 'fail',
			`GET /readyz → ${result.httpStatus ?? result.error} in ${result.timeMs}ms`,
		),
		sub(
			'dependencies-healthy',
			dependencyStates.length === 0 ? 'unknown' : requiredUnhealthy.length === 0 ? 'pass' : 'fail',
			dependencyStates.length === 0
				? `no dependency states in body: ${excerpt(result.bodyText, 160)}`
				: JSON.stringify(dependencyStates),
		),
		sub(
			'sha-consistent-with-healthz',
			liveSha && bodySha ? (liveSha === bodySha ? 'pass' : 'fail') : 'unknown',
			`healthz=${liveSha ?? 'missing'} readyz=${bodySha ?? 'missing'}`,
		),
	]
	return {
		id: 'readyz',
		title: 'api readiness + dependency states',
		status: combine(subResults),
		required: true,
		unknownReason: null,
		summary: `GET /readyz → ${result.httpStatus ?? 'no response'}; slice=${asString(body?.slice) ?? '?'} stub=${stubValue}; deps=${
			dependencyStates
				.map(
					(entry) =>
						`${entry.name}:${entry.ok === true ? 'ok' : entry.ok === false ? 'down' : '?'}`,
				)
				.join(',') || 'none'
		}`,
		sub: subResults,
		evidence: {
			...httpEvidence(result),
			status: asString(body?.status),
			slice: asString(body?.slice),
			stub: typeof body?.stub === 'boolean' ? body.stub : null,
			uptimeS: typeof body?.uptime_s === 'number' ? body.uptime_s : null,
			gitCommitSha: bodySha,
			dependencies: dependencyStates,
		},
	}
}

type DiscoveryResult = {
	check: Check
	freeSlug: string | null
	freeResult: ConnectResult | null
	productDayKeyFromServer: string | null
	puzzleData: unknown
	observedAtMs: number
}

type SlugVerdict = 'free' | 'fail-closed' | 'violation' | 'indeterminate'

/**
 * Classify one rotation read. A 200 is today's free slug; a 403 with
 * `premium_required` is the fail-closed evidence; anything else is a
 * violation (4xx / unexpected 2xx) or indeterminate (5xx / transport error).
 */
function classifySlugResult(result: ConnectResult): SlugVerdict {
	if (result.httpStatus === 200) return 'free'
	if (result.httpStatus === 403 && result.connectMessage === 'premium_required') {
		return 'fail-closed'
	}
	if (result.httpStatus === null || result.httpStatus >= 500) return 'indeterminate'
	return 'violation'
}

async function checkFreeSlugDiscovery(options: Options): Promise<DiscoveryResult> {
	type ProbedSlug = {
		slug: string
		result: ConnectResult
		attempts: ConnectResult[]
		retried: boolean
	}
	const results: ProbedSlug[] = []
	for (const slug of FREE_ROTATION) {
		const probe = () =>
			connectUnary(
				options.base,
				'GetDaily',
				{ gameSlug: slug },
				{
					guestId: options.guest,
					timeoutMs: options.timeoutMs,
				},
			)
		const attempts: ConnectResult[] = []
		let result = await probe()
		attempts.push(result)
		// 5xx / transport failure is not evidence about the gate: retry once and
		// keep both attempts. A retry that still fails stays indeterminate — a
		// 5xx is never rounded to a pass.
		if (result.httpStatus === null || result.httpStatus >= 500) {
			result = await probe()
			attempts.push(result)
		}
		results.push({ slug, result, attempts, retried: attempts.length > 1 })
	}
	const verdicts = results.map((entry) => ({
		slug: entry.slug,
		verdict: classifySlugResult(entry.result),
		httpStatus: entry.result.httpStatus,
		connectCode: entry.result.connectCode,
		connectMessage: entry.result.connectMessage,
		timeMs: entry.result.timeMs,
		retried: entry.retried,
		attempts: entry.attempts.length,
		firstAttemptHttpStatus: entry.attempts[0]?.httpStatus ?? null,
		firstAttemptError: entry.attempts[0]?.error ?? null,
	}))
	const free = verdicts.filter((entry) => entry.verdict === 'free')
	const failClosed = verdicts.filter((entry) => entry.verdict === 'fail-closed')
	const violations = verdicts.filter((entry) => entry.verdict === 'violation')
	const indeterminate = verdicts.filter((entry) => entry.verdict === 'indeterminate')
	const freeEntry = free[0] ?? null
	const freeResultEntry = results.find((entry) => entry.slug === freeEntry?.slug) ?? null
	const freeBody = freeResultEntry ? asRecord(freeResultEntry.result.bodyJson) : null
	const puzzleDate = asString(freeBody?.puzzleDate)
	const localDayKey = productDayKey()
	const serverDayKey = isDayKey(puzzleDate) ? puzzleDate : null
	const verdictText = verdicts
		.map(
			(entry) =>
				`${entry.slug}=${entry.verdict}(${entry.httpStatus ?? 'no-response'})${
					entry.retried
						? `[retried after ${entry.firstAttemptHttpStatus ?? entry.firstAttemptError ?? 'transport error'}]`
						: ''
				}`,
		)
		.join(' ')
	const subResults: SubResult[] = []
	subResults.push(
		sub(
			'single-free-slug',
			free.length === 1
				? 'pass'
				: free.length === 0 && violations.length === 0
					? 'unknown'
					: 'fail',
			free.length === 1
				? `free slug today = ${free[0].slug} (200)`
				: `expected exactly one 200 across rotation; got ${free.length}: ${
						free.map((entry) => entry.slug).join(',') || 'none'
					} (${verdictText})`,
		),
	)
	const failClosedOk = violations.length === 0 && free.length === 1 && failClosed.length === 4
	subResults.push(
		sub(
			'non-free-fail-closed-403-premium-required',
			violations.length > 0 ? 'fail' : failClosedOk ? 'pass' : 'unknown',
			failClosedOk
				? `all ${failClosed.length} non-free slugs → 403 premium_required`
				: `${verdictText}${
						indeterminate.length > 0
							? ' — indeterminate responses mean the gate could not be observed this run'
							: ''
					}`,
		),
	)
	subResults.push(
		sub(
			'product-day-key-matches-hkt',
			serverDayKey === null ? 'unknown' : serverDayKey === localDayKey ? 'pass' : 'fail',
			serverDayKey === null
				? `server puzzleDate missing/unparseable; local Asia/Hong_Kong expectation=${localDayKey}`
				: `server puzzleDate=${serverDayKey} local Asia/Hong_Kong=${localDayKey}${
						serverDayKey === localDayKey ? ' (match)' : ' (MISMATCH — stale or wrong day key)'
					}`,
		),
	)
	let puzzleData: unknown = null
	if (freeBody && typeof freeBody.puzzleDataJson === 'string') {
		puzzleData = safeJsonParse(freeBody.puzzleDataJson).value
	}
	return {
		check: {
			id: 'free-slug-discovery',
			title: "today's free module discovery (rotation)",
			status: combine(subResults),
			required: true,
			unknownReason: null,
			summary: `${freeEntry ? `free slug = ${freeEntry.slug}` : 'no free slug discovered'}; non-free fail-closed ${
				failClosedOk ? 'ok' : 'NOT ok'
			}; day key ${serverDayKey ?? 'missing'}${
				serverDayKey && serverDayKey !== localDayKey ? ` MISMATCH vs local HKT ${localDayKey}` : ''
			}`,
			sub: subResults,
			evidence: {
				base: options.base,
				guestId: options.guest,
				rotation: [...FREE_ROTATION],
				requests: results.map((entry) => ({
					slug: entry.slug,
					verdict: classifySlugResult(entry.result),
					retried: entry.retried,
					attempts: entry.attempts.map((attempt, index) => ({
						attempt: index + 1,
						...connectEvidence(attempt),
					})),
				})),
				verdicts,
				freeSlug: freeEntry?.slug ?? null,
				freeSlugPuzzleDate: puzzleDate ?? null,
				expectedLocalProductDayKey: localDayKey,
			},
		},
		freeSlug: freeEntry?.slug ?? null,
		freeResult: freeResultEntry?.result ?? null,
		productDayKeyFromServer: isDayKey(puzzleDate) ? puzzleDate : null,
		puzzleData,
		observedAtMs: Date.now(),
	}
}

function scanLeakKeys(
	value: unknown,
	path: string,
	findings: Array<{ path: string; key: string; valuePreview: string }>,
): void {
	if (Array.isArray(value)) {
		value.forEach((entry, index) => {
			scanLeakKeys(entry, `${path}[${index}]`, findings)
		})
		return
	}
	const record = asRecord(value)
	if (!record) return
	for (const [key, entry] of Object.entries(record)) {
		if (CLIENT_LEAK_KEYS.has(key.toLowerCase())) {
			findings.push({
				path: `${path}.${key}`,
				key,
				valuePreview: excerpt(JSON.stringify(entry ?? null), 120),
			})
		}
		scanLeakKeys(entry, `${path}.${key}`, findings)
	}
}

async function checkDailyServe(
	discovery: DiscoveryResult,
	guestId: string,
	guestProvided: boolean,
): Promise<Check> {
	if (!discovery.freeSlug || !discovery.freeResult) {
		return {
			id: 'daily-serve',
			title: 'free daily serve (GetDaily)',
			status: 'unknown',
			required: true,
			unknownReason: 'indeterminate',
			summary: 'no free slug discovered; GetDaily serve cannot be asserted',
			sub: [sub('free-slug-required', 'unknown', 'discovery did not yield exactly one free slug')],
			evidence: { freeSlug: null },
		}
	}
	const result = discovery.freeResult
	const body = asRecord(result.bodyJson)
	const puzzleDataJson = asString(body?.puzzleDataJson) ?? ''
	const puzzleParse = puzzleDataJson
		? safeJsonParse(puzzleDataJson)
		: { value: null, error: 'empty' }
	const hasCompleted = body?.hasCompleted
	const hasCompletedType =
		hasCompleted === undefined ? 'absent (proto implicit presence = false)' : typeof hasCompleted
	const canPlay = typeof body?.canPlay === 'boolean' ? body.canPlay : null
	const stubText = typeof body?.stub === 'boolean' ? String(body.stub) : 'absent(false)'
	const puzzleKeys = Object.keys(asRecord(puzzleParse.value) ?? {})
	const leakFindings: Array<{ path: string; key: string; valuePreview: string }> = []
	scanLeakKeys(result.bodyJson, '$', leakFindings)
	const rawLeakMatches = Array.from(
		result.bodyText.matchAll(/"(solution|answer|solutionJson|solution_json)"\s*:/gi),
	).map((match) =>
		excerpt(
			result.bodyText.slice(Math.max(0, (match.index ?? 0) - 40), (match.index ?? 0) + 80),
			160,
		),
	)
	const subResults: SubResult[] = [
		sub(
			'http-200',
			result.httpStatus === 200 ? 'pass' : 'fail',
			`GetDaily(${discovery.freeSlug}) → ${result.httpStatus} in ${result.timeMs}ms`,
		),
		sub(
			'puzzle-data-json',
			// A payload with zero keys is not a served puzzle (reviewer F3):
			// require a parseable object carrying at least one key.
			puzzleDataJson && !puzzleParse.error && puzzleKeys.length >= 1 ? 'pass' : 'fail',
			puzzleDataJson
				? `puzzleDataJson ${puzzleDataJson.length}B parseError=${puzzleParse.error ?? 'none'} keys=${
						puzzleKeys.join(',') || '(none)'
					}${puzzleKeys.length === 0 ? ' — empty payload object is not a served puzzle' : ''}`
				: 'puzzleDataJson empty',
		),
		sub(
			'has-completed-flag',
			hasCompleted !== undefined && typeof hasCompleted !== 'boolean'
				? 'fail'
				: hasCompleted === true && !guestProvided
					? 'fail'
					: 'pass',
			`hasCompleted=${hasCompleted === undefined ? 'absent' : JSON.stringify(hasCompleted)} (${hasCompletedType}); canPlay=${String(canPlay)}${
				hasCompleted === true
					? guestProvided
						? '; provided guest already has an accepted finish for this module/day'
						: '; FRESH guest reported an accepted finish'
					: ''
			}`,
		),
		sub(
			'no-solution-or-answer-keys',
			leakFindings.length === 0 && rawLeakMatches.length === 0 ? 'pass' : 'fail',
			leakFindings.length === 0 && rawLeakMatches.length === 0
				? 'recursive key scan found no answer/solution/word/queens keys'
				: `key findings=${JSON.stringify(leakFindings)} raw matches=${JSON.stringify(rawLeakMatches)}`,
		),
	]
	return {
		id: 'daily-serve',
		title: 'free daily serve (GetDaily)',
		status: combine(subResults),
		required: true,
		unknownReason: null,
		summary: `GetDaily(${discovery.freeSlug}) → 200; puzzleDate=${asString(body?.puzzleDate) ?? '?'} puzzleNumber=${String(body?.puzzleNumber ?? '?')} mode=${asString(body?.mode) ?? '?'} stub=${stubText}; ${
			leakFindings.length + rawLeakMatches.length === 0 ? 'no solution keys' : 'SOLUTION KEY LEAK'
		}`,
		sub: subResults,
		evidence: {
			...connectEvidence(result),
			guestId,
			guestProvided,
			gameSlug: discovery.freeSlug,
			puzzleNumber: typeof body?.puzzleNumber === 'number' ? body.puzzleNumber : null,
			puzzleDate: asString(body?.puzzleDate),
			puzzleId: asString(body?.puzzleId),
			difficulty: asString(body?.difficulty),
			mode: asString(body?.mode),
			slice: asString(body?.slice),
			stub: typeof body?.stub === 'boolean' ? body.stub : null,
			hasCompleted: hasCompleted === undefined ? null : hasCompleted,
			hasCompletedField: hasCompletedType,
			canPlay,
			puzzleDataJsonBytes: puzzleDataJson.length,
			puzzleDataKeys: Object.keys(asRecord(puzzleParse.value) ?? {}),
			leakFindings,
			rawLeakMatches,
		},
	}
}

async function checkWebDocument(
	options: Options,
	discovery: DiscoveryResult,
): Promise<{
	check: Check
	html: string
	canonical: string | null
	canonicalLocalhost: boolean
	result: HttpResult
}> {
	const result = await httpRequest(`${options.base}/`, {
		headers: { accept: 'text/html,application/xhtml+xml' },
		timeoutMs: options.timeoutMs,
	})
	const html = result.bodyText
	const canonicalMatch = html.match(
		/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']|<link[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["']/i,
	)
	const canonical = canonicalMatch ? (canonicalMatch[1] ?? canonicalMatch[2] ?? null) : null
	const targetHost = hostOf(options.base)
	const targetIsLocal = isLocalHostname(targetHost)
	const canonicalLocalhost = Boolean(canonical && LOCALHOST_RE.test(canonical))
	const hrefs = Array.from(html.matchAll(/href=["']([^"']+)["']/gi)).map((match) => match[1])
	const gamesHrefs = hrefs.filter((href) => /\/games\//.test(href))
	const targetHostWithPort = new URL(options.base).host
	const freeGameHrefs = discovery.freeSlug
		? hrefs.filter((href) =>
				ctaHrefMatches(href, discovery.freeSlug as string, options.base, targetHostWithPort),
			)
		: []
	const rejectedGameHrefs = discovery.freeSlug
		? gamesHrefs.filter((href) => !freeGameHrefs.includes(href))
		: gamesHrefs
	const htmlOk =
		result.httpStatus === 200 && Boolean(result.contentType?.toLowerCase().includes('text/html'))
	const textBody = html
		.replace(/<script[\s\S]*?<\/script>/gi, ' ')
		.replace(/<style[\s\S]*?<\/style>/gi, ' ')
		.replace(/<[^>]+>/g, ' ')
	const subResults: SubResult[] = [
		sub(
			'html-200',
			result.httpStatus === null ? 'unknown' : htmlOk ? 'pass' : 'fail',
			`GET / → ${result.httpStatus ?? result.error}; content-type=${result.contentType ?? 'none'}; ${result.bodyBytes}B in ${result.timeMs}ms`,
		),
		sub(
			'canonical-not-localhost',
			!canonical ? 'unknown' : canonicalLocalhost && !targetIsLocal ? 'fail' : 'pass',
			canonical
				? `canonical=${canonical}${canonicalLocalhost ? ` (localhost origin) target host=${targetHost}` : ''}`
				: 'no <link rel="canonical"> in served HTML',
		),
		sub(
			'daily-ritual-cta',
			discovery.freeSlug ? (freeGameHrefs.length > 0 ? 'pass' : 'fail') : 'unknown',
			discovery.freeSlug
				? `free slug=${discovery.freeSlug}; hrefs to /games/${discovery.freeSlug}: ${freeGameHrefs.length}; all /games/ hrefs: ${gamesHrefs.length}`
				: 'free slug unknown; CTA cannot be evaluated',
		),
	]
	return {
		check: {
			id: 'web-document',
			title: 'web document (canonical + daily-ritual CTA)',
			status: combine(subResults),
			required: true,
			unknownReason: null,
			summary: `GET / → ${result.httpStatus ?? 'no response'}; canonical=${canonical ?? 'missing'}${
				canonicalLocalhost && !targetIsLocal ? ' (LOCALHOST on non-local host)' : ''
			}; today's-free-game hrefs=${freeGameHrefs.length}`,
			sub: subResults,
			evidence: {
				...httpEvidence(result),
				canonical,
				canonicalLocalhost,
				targetHost,
				targetIsLocal,
				freeSlug: discovery.freeSlug,
				freeGameHrefs,
				gamesHrefs: gamesHrefs.slice(0, 20),
				gamesHrefCount: gamesHrefs.length,
				rejectedGameHrefs: rejectedGameHrefs.slice(0, 10),
				ctaMatcherNote:
					'CTA hrefs must be same-origin and resolve to /games/<slug> (one optional locale prefix); nested or off-site paths do not count',
				renderedTextExcerpt: excerpt(textBody, 300),
			},
		},
		html,
		canonical,
		canonicalLocalhost,
		result,
	}
}

type ShareResult = {
	check: Check
}

/**
 * `/games/<slug>` path with an optional single locale prefix
 * (`/en-US/games/sudoku`). Anything else (e.g. a login wall) is not the module.
 */
function pathIsModulePath(pathname: string, slug: string): boolean {
	const segments = pathname.split('/').filter(Boolean)
	if (segments.length === 2) return segments[0] === 'games' && segments[1] === slug
	if (segments.length === 3) {
		return (
			/^[a-z]{2}(?:-[A-Za-z]{2,4})?$/.test(segments[0]) &&
			segments[1] === 'games' &&
			segments[2] === slug
		)
	}
	return false
}

/**
 * A daily-ritual CTA href must be same-origin and resolve to `/games/<slug>`
 * (one optional locale prefix). Off-site or nested `…/games/<slug>` paths do
 * not count as a link to today's module (reviewer disclosure).
 */
function ctaHrefMatches(href: string, slug: string, base: string, targetHost: string): boolean {
	let url: URL
	try {
		url = new URL(href, base)
	} catch {
		return false
	}
	if (url.host !== targetHost) return false
	return pathIsModulePath(url.pathname, slug)
}

async function checkShareDeepLink(
	options: Options,
	discovery: DiscoveryResult,
	productDayKeyValue: string,
	productDayKeySource: string,
	terminalPlan: TerminalPlan | null,
): Promise<ShareResult> {
	if (!discovery.freeSlug) {
		return {
			check: {
				id: 'share-deep-link',
				title: 'share / deep link (non-spoiler)',
				status: 'unknown',
				required: true,
				unknownReason: 'indeterminate',
				summary: 'free slug unknown; deep link cannot be exercised',
				sub: [
					sub('free-slug-required', 'unknown', 'discovery did not yield exactly one free slug'),
				],
				evidence: { freeSlug: null },
			},
		}
	}
	const path = `/games/${discovery.freeSlug}?date=${productDayKeyValue}`
	const url = `${options.base}${path}`
	const first = await httpRequest(url, {
		headers: { accept: 'text/html,application/xhtml+xml' },
		redirect: 'manual',
		timeoutMs: options.timeoutMs,
	})
	let final = first
	let redirectChain: Array<{ httpStatus: number | null; location: string | null }> = [
		{ httpStatus: first.httpStatus, location: first.location },
	]
	if (
		first.httpStatus !== null &&
		first.httpStatus >= 300 &&
		first.httpStatus < 400 &&
		first.location
	) {
		const followed = await httpRequest(new URL(first.location, options.base).toString(), {
			headers: { accept: 'text/html,application/xhtml+xml' },
			timeoutMs: options.timeoutMs,
		})
		final = followed
		redirectChain = [
			...redirectChain,
			{ httpStatus: followed.httpStatus, location: followed.location },
		]
	}
	const finalHtml = final.bodyText
	const targetHost = new URL(options.base).host
	const finalUrlParsed = (() => {
		try {
			return new URL(final.url)
		} catch {
			return null
		}
	})()
	const finalPath = finalUrlParsed?.pathname ?? null
	const finalHost = finalUrlParsed?.host ?? null
	const onModulePath = finalPath !== null && pathIsModulePath(finalPath, discovery.freeSlug)
	const sameOrigin = finalHost !== null && finalHost === targetHost
	const finalOk =
		final.httpStatus === 200 &&
		Boolean(final.contentType?.toLowerCase().includes('text/html')) &&
		onModulePath &&
		sameOrigin
	// Request-shape note only: the harness *chooses* the documented share path
	// (module + ?date=, per apps/puzzled …/share-text.ts ritualSharePath). The
	// app-side formatRitualShareText output is not observed here, so this is not
	// asserted as product behavior.
	const requestedPathShapeOk =
		/^\/games\/[a-z0-9-]+\?date=\d{4}-\d{2}-\d{2}$/.test(path) && isDayKey(productDayKeyValue)
	const leakPatternFindings: string[] = []
	for (const pattern of [/"solutionJson"\s*:/i, /"solution_json"\s*:/i, /"solution"\s*:\s*\[/i]) {
		const match = finalHtml.match(pattern)
		if (match) {
			leakPatternFindings.push(
				excerpt(
					finalHtml.slice(Math.max(0, (match.index ?? 0) - 60), (match.index ?? 0) + 120),
					200,
				),
			)
		}
	}
	const solutionSignatures = terminalPlan?.solutionSignatures ?? []
	const solutionSignatureHits = solutionSignatures.filter((signature) =>
		finalHtml.includes(signature),
	)
	const solutionSignatureSha256s = await Promise.all(
		solutionSignatures.map((signature) => sha256Hex(signature)),
	)
	const subResults: SubResult[] = [
		sub(
			'deep-link-html',
			first.httpStatus === null || final.httpStatus === null
				? 'unknown'
				: finalOk
					? 'pass'
					: 'fail',
			`GET ${path} → ${first.httpStatus ?? first.error}${
				first.location ? ` → ${first.location} → ${final.httpStatus}` : ''
			}; final path=${finalPath ?? 'unparsed'} (module path=${onModulePath}, same origin=${sameOrigin}); content-type=${final.contentType ?? 'none'}; ${final.bodyBytes}B in ${final.timeMs}ms`,
		),
		sub(
			'landing-no-solution-key-patterns',
			!finalHtml || final.bodyTruncated
				? 'unknown'
				: leakPatternFindings.length === 0
					? 'pass'
					: 'fail',
			finalHtml
				? `solution-shaped JSON key patterns in landing payload: ${leakPatternFindings.length}${
						final.bodyTruncated
							? ` — landing body truncated at ${final.bodyBytes}B cap; a pattern past the cap would not be seen`
							: ''
					}`
				: 'no landing HTML observed',
		),
		sub(
			'landing-no-solution-signature',
			!finalHtml || final.bodyTruncated
				? 'unknown'
				: solutionSignatures.length === 0
					? 'unknown'
					: solutionSignatureHits.length === 0
						? 'pass'
						: 'fail',
			final.bodyTruncated
				? `landing body truncated at ${final.bodyBytes}B cap; the signature compare covers only the first bytes, so absence is not evidence`
				: solutionSignatures.length === 0
					? `no locally solved signature for ${discovery.freeSlug} (harness cannot solve this module); grid-leak comparison NOT performed`
					: `${solutionSignatures.length} locally solved signature(s) checked against the landing payload; hits=${solutionSignatureHits.length}`,
		),
	]
	return {
		check: {
			id: 'share-deep-link',
			title: 'share / deep link (non-spoiler)',
			status: combine(subResults),
			required: true,
			unknownReason: combine(subResults) === 'unknown' ? 'indeterminate' : null,
			summary: `GET ${path} → ${first.httpStatus ?? 'no response'}${
				first.location ? ` → ${final.httpStatus}` : ''
			}; final path=${finalPath ?? 'unparsed'}(module=${onModulePath}); product day key ${productDayKeyValue} (${productDayKeySource}); solution-signature hits=${
				solutionSignatureHits.length
			}${solutionSignatures.length === 0 ? ' (signature unknown)' : ''}${
				final.bodyTruncated ? '; landing body TRUNCATED (leak scans incomplete)' : ''
			}`,
			sub: subResults,
			evidence: {
				requestedPath: path,
				requestedUrl: url,
				requestedPathShapeOk,
				requestedPathNote:
					'harness requested the documented module+?date= shape (share-text.ts ritualSharePath); formatRitualShareText output is app-side and not observed here',
				productDayKey: productDayKeyValue,
				productDayKeySource,
				redirectChain,
				finalUrl: final.url,
				finalPath,
				finalHost,
				targetHost,
				onModulePath,
				sameOrigin,
				...httpEvidence(final),
				leakPatternFindings,
				solutionSignatureCount: solutionSignatures.length,
				solutionSignatureSha256s,
				solutionSignatureHits: solutionSignatureHits.length,
				solutionSignatureNote:
					'signatures are redacted (sha256 identifies them) so the harness does not publish a solution',
			},
		},
	}
}

async function checkPremiumFailClosed(
	options: Options,
	discovery: DiscoveryResult,
	productDayKeyValue: string,
): Promise<Check> {
	const pastDate = shiftDayKey(productDayKeyValue, -1)
	const archiveSlug = discovery.freeSlug ?? 'sudoku'
	const archive = await connectUnary(
		options.base,
		'GetDaily',
		{ gameSlug: archiveSlug, puzzleDate: pastDate },
		{ guestId: null, timeoutMs: options.timeoutMs },
	)
	const archiveFailClosed =
		archive.httpStatus === 403 && archive.connectMessage === 'premium_required'
	const pricingUrl = `${options.base}/pricing`
	const pricing = await httpRequest(pricingUrl, {
		headers: { accept: 'text/html,application/xhtml+xml' },
		timeoutMs: options.timeoutMs,
	})
	const pricingOk =
		pricing.httpStatus === 200 && Boolean(pricing.contentType?.toLowerCase().includes('text/html'))
	const gatedSlug = FREE_ROTATION.find((slug) => slug !== discovery.freeSlug) ?? 'word-guess'
	const gated = await httpRequest(`${options.base}/games/${gatedSlug}`, {
		headers: { accept: 'text/html,application/xhtml+xml' },
		timeoutMs: options.timeoutMs,
	})
	const gatedPricingHrefs = Array.from(
		gated.bodyText.matchAll(/href=["']([^"']*\/pricing[^"']*)["']/gi),
	).map((match) => match[1])
	const gatedUpgradePathOk = gated.httpStatus === 200 && gatedPricingHrefs.length > 0
	const subResults: SubResult[] = [
		sub(
			'archive-fails-closed-anonymous',
			// A 5xx/transport failure is not evidence about the archive gate
			// (same rule as the rotation probes): unknown, never a pass.
			archive.httpStatus === null || archive.httpStatus >= 500
				? 'unknown'
				: archiveFailClosed
					? 'pass'
					: 'fail',
			`anonymous GetDaily(${archiveSlug}, puzzleDate=${pastDate}) → ${archive.httpStatus ?? archive.error}:${
				archive.connectMessage ?? '?'
			}`,
		),
		sub(
			'pricing-200',
			pricing.httpStatus === null ? 'unknown' : pricingOk ? 'pass' : 'fail',
			`GET /pricing → ${pricing.httpStatus ?? pricing.error}; content-type=${pricing.contentType ?? 'none'}`,
		),
		sub(
			'upgrade-path-from-gated-surface',
			gated.httpStatus === null ? 'unknown' : gatedUpgradePathOk ? 'pass' : 'fail',
			`GET /games/${gatedSlug} (non-free today) → ${gated.httpStatus ?? gated.error}; /pricing hrefs=${JSON.stringify(
				gatedPricingHrefs,
			)}`,
		),
	]
	return {
		id: 'premium-fail-closed',
		title: 'premium fail-closed + upgrade path',
		status: combine(subResults),
		required: true,
		unknownReason: null,
		summary: `archive ${archiveSlug}@${pastDate} → ${archive.httpStatus ?? 'no response'}:${archive.connectMessage ?? '?'}; /pricing → ${
			pricing.httpStatus ?? 'no response'
		}; gated /games/${gatedSlug} /pricing hrefs=${gatedPricingHrefs.length}`,
		sub: subResults,
		evidence: {
			archiveRequest: { gameSlug: archiveSlug, puzzleDate: pastDate, ...connectEvidence(archive) },
			pricing: httpEvidence(pricing),
			gatedSurface: {
				slug: gatedSlug,
				...httpEvidence(gated),
				pricingHrefs: gatedPricingHrefs,
			},
		},
	}
}

type Zone = { kind: 'title' | 'meta' | 'json-ld'; start: number; end: number; label: string }

function collectZones(html: string): Zone[] {
	const zones: Zone[] = []
	for (const match of html.matchAll(/<title[^>]*>([\s\S]*?)<\/title>/gi)) {
		zones.push({
			kind: 'title',
			start: match.index ?? 0,
			end: (match.index ?? 0) + match[0].length,
			label: 'title',
		})
	}
	for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
		const tag = match[0]
		const nameMatch =
			tag.match(/\b(?:name|property)=["']([^"']+)["']/i) ?? tag.match(/\bname=["']([^"']+)["']/i)
		zones.push({
			kind: 'meta',
			start: match.index ?? 0,
			end: (match.index ?? 0) + tag.length,
			label: `meta[${nameMatch?.[1] ?? '?'}]`,
		})
	}
	for (const match of html.matchAll(/<script\b[^>]*application\/ld\+json[^>]*>/gi)) {
		const openEnd = (match.index ?? 0) + match[0].length
		const closeIndex = html.indexOf('</script>', openEnd)
		const end = closeIndex === -1 ? html.length : closeIndex + '</script>'.length
		const content = html.slice(openEnd, closeIndex === -1 ? html.length : closeIndex)
		let label = 'json-ld'
		try {
			const parsed = JSON.parse(content) as unknown
			const record = asRecord(parsed)
			const type = record ? asString(record['@type']) : null
			if (type) label = `json-ld[${type}]`
		} catch {
			// leave default label
		}
		zones.push({ kind: 'json-ld', start: match.index ?? 0, end, label })
	}
	return zones
}

function zoneFor(zones: Zone[], index: number): Zone | null {
	for (const zone of zones) {
		if (index >= zone.start && index < zone.end) return zone
	}
	return null
}

type MarksFindings = {
	hardFailures: Array<{ mark: string; zone: string; context: string }>
	warnings: Array<{ mark: string; context: string }>
	warningCount: number
}

function scanMarks(html: string, zones: Zone[], maxWarnings = 10): MarksFindings {
	const hardFailures: MarksFindings['hardFailures'] = []
	const warnings: MarksFindings['warnings'] = []
	let warningCount = 0
	for (const { mark, pattern } of FORBIDDEN_MARKS) {
		const regex = new RegExp(pattern.source, 'gi')
		for (const match of html.matchAll(regex)) {
			const index = match.index ?? 0
			const zone = zoneFor(zones, index)
			const context = contextAround(html, index, match[0].length)
			if (zone) {
				hardFailures.push({ mark, zone: zone.label, context })
			} else {
				warningCount += 1
				if (warnings.length < maxWarnings) warnings.push({ mark, context })
			}
		}
	}
	return { hardFailures, warnings, warningCount }
}

async function checkMarksScan(
	options: Options,
	discovery: DiscoveryResult,
	homeResult: HttpResult | null,
	homeCanonicalLocalhost: boolean,
): Promise<Check> {
	const targets: Array<{
		url: string
		label: string
		html: string | null
		httpStatus: number | null
		contentType: string | null
		bodyBytes: number
		bodySha256: string | null
		bodyTruncated: boolean
		error: string | null
	}> = []
	const homeHtml = homeResult?.bodyText ?? null
	if (homeResult) {
		targets.push({
			url: homeResult.url,
			label: 'home',
			html: homeResult.bodyText || null,
			httpStatus: homeResult.httpStatus,
			contentType: homeResult.contentType,
			bodyBytes: homeResult.bodyBytes,
			bodySha256: homeResult.bodySha256,
			bodyTruncated: homeResult.bodyTruncated,
			error: homeResult.error,
		})
	}
	let gameHtml: string | null = null
	if (discovery.freeSlug) {
		const game = await httpRequest(`${options.base}/games/${discovery.freeSlug}`, {
			headers: { accept: 'text/html,application/xhtml+xml' },
			timeoutMs: options.timeoutMs,
		})
		gameHtml = game.bodyText || null
		targets.push({
			url: `${options.base}/games/${discovery.freeSlug}`,
			label: `games/${discovery.freeSlug}`,
			html: gameHtml,
			httpStatus: game.httpStatus,
			contentType: game.contentType,
			bodyBytes: game.bodyBytes,
			bodySha256: game.bodySha256,
			bodyTruncated: game.bodyTruncated,
			error: game.error,
		})
	}

	const targetFindings: Array<Record<string, unknown>> = []
	let hardFailureCount = 0
	let warningCount = 0
	let jsonLdLocalhost: string[] = []
	let canonicalLocalhost = false
	for (const target of targets) {
		if (!target.html) {
			targetFindings.push({
				url: target.url,
				httpStatus: target.httpStatus,
				error: target.error ?? 'no body',
				hardFailures: [],
				warnings: [],
			})
			continue
		}
		const zones = collectZones(target.html)
		const findings = scanMarks(target.html, zones)
		hardFailureCount += findings.hardFailures.length
		warningCount += findings.warningCount
		const ldJsonMatches = Array.from(
			target.html.matchAll(/<script\b[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi),
		).map((match) => match[1])
		const localhostHits = ldJsonMatches
			.filter((content) => /https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(content))
			.map((content) => excerpt(content, 160))
		jsonLdLocalhost = jsonLdLocalhost.concat(localhostHits)
		const canonicalMatch = target.html.match(
			/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']|<link[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["']/i,
		)
		const canonical = canonicalMatch ? (canonicalMatch[1] ?? canonicalMatch[2] ?? null) : null
		const canonicalIsLocalhost = Boolean(canonical && LOCALHOST_RE.test(canonical))
		if (canonicalIsLocalhost) canonicalLocalhost = true
		targetFindings.push({
			url: target.url,
			label: target.label,
			httpStatus: target.httpStatus,
			contentType: target.contentType,
			bodyBytes: target.bodyBytes,
			bodySha256: target.bodySha256,
			bodyTruncated: target.bodyTruncated,
			hardFailures: findings.hardFailures,
			warnings: findings.warnings,
			warningCount: findings.warningCount,
			canonical,
			canonicalLocalhost: canonicalIsLocalhost,
			jsonLdLocalhostHits: localhostHits,
		})
	}
	// The manifest is part of the player-facing identity surface (short_name).
	// Not observing it is `unknown`, not a silent pass (reviewer disclosure).
	let manifestState: 'scanned' | 'not-observed' = 'not-observed'
	let manifestNotObservedReason: string | null = null
	const manifestHref =
		homeHtml?.match(/<link[^>]*rel=["']manifest["'][^>]*href=["']([^"']+)["']/i)?.[1] ?? null
	let manifestEvidence: Record<string, unknown> = { url: null, httpStatus: null }
	if (!homeHtml) {
		manifestNotObservedReason = 'home HTML was not observed; manifest link could not be read'
	} else if (!manifestHref) {
		manifestNotObservedReason = 'served home HTML has no <link rel="manifest">'
	} else {
		const manifestUrl = new URL(manifestHref, options.base).toString()
		const manifest = await httpRequest(manifestUrl, { timeoutMs: options.timeoutMs })
		const manifestJson = asRecord(manifest.bodyJson)
		const manifestFields: Record<string, string | null> = {
			name: asString(manifestJson?.name),
			short_name: asString(manifestJson?.short_name),
			description: asString(manifestJson?.description),
		}
		const manifestHardFailures: Array<{ mark: string; field: string; value: string }> = []
		for (const [field, value] of Object.entries(manifestFields)) {
			if (!value) continue
			for (const { mark, pattern } of FORBIDDEN_MARKS) {
				if (new RegExp(pattern.source, 'i').test(value)) {
					manifestHardFailures.push({ mark, field: `manifest.${field}`, value })
				}
			}
		}
		hardFailureCount += manifestHardFailures.length
		if (manifest.httpStatus === 200 && manifestJson) {
			manifestState = 'scanned'
		} else {
			manifestNotObservedReason = `manifest fetch/parse failed (HTTP ${manifest.httpStatus ?? manifest.error}; body ${excerpt(manifest.bodyText, 80)})`
		}
		manifestEvidence = {
			url: manifestUrl,
			httpStatus: manifest.httpStatus,
			contentType: manifest.contentType,
			bodySha256: manifest.bodySha256,
			fields: manifestFields,
			hardFailures: manifestHardFailures,
		}
	}
	const targetHost = hostOf(options.base)
	const targetIsLocal = isLocalHostname(targetHost)
	const localhostFails = targetIsLocal ? [] : jsonLdLocalhost
	const productIdentityOk =
		/Puzzled/i.test(homeHtml ?? '') || /rel=["']manifest["']/i.test(homeHtml ?? '')
	const truncatedTargets = targets
		.filter((target) => target.bodyTruncated)
		.map((target) => target.label)
	const unobservedTargets = targets.filter((target) => !target.html).map((target) => target.label)
	const subResults: SubResult[] = [
		sub(
			'target-identity',
			productIdentityOk ? 'pass' : 'unknown',
			productIdentityOk
				? 'served home HTML identifies as the Puzzled web app (title/manifest reference)'
				: 'served home HTML does not identify as the Puzzled web app; the mark scan is vacuous here',
		),
		sub(
			'manifest-observed-and-scanned',
			manifestState === 'scanned' ? 'pass' : 'unknown',
			manifestState === 'scanned'
				? `manifest scanned: ${String(manifestEvidence.url)} (${
						Object.entries(asRecord(manifestEvidence.fields) ?? {})
							.filter(([, value]) => typeof value === 'string' && value)
							.map(([field]) => field)
							.join(',') || 'no name/short_name/description fields'
					})`
				: `manifest not observed: ${manifestNotObservedReason ?? 'unknown reason'}`,
		),
		sub(
			// Renamed (reviewer wording nit): the manifest dimension has its own
			// sub-check, so this one claims only title/meta/JSON-LD zones.
			'no-forbidden-marks-in-title-meta-jsonld',
			hardFailureCount > 0
				? 'fail'
				: unobservedTargets.length > 0 || truncatedTargets.length > 0
					? 'unknown'
					: 'pass',
			hardFailureCount === 0
				? `no CATALOG §3.2 mark in title/meta/JSON-LD across ${targets.length} target(s)${
						truncatedTargets.length > 0
							? ` — body truncated at the cap for ${truncatedTargets.join(',')}; a mark past the cap would not be seen`
							: ''
					}${unobservedTargets.length > 0 ? ` — no body for ${unobservedTargets.join(',')}` : ''}`
				: `${hardFailureCount} hard failure(s): ${JSON.stringify(
						targetFindings.flatMap((entry) =>
							Array.isArray(entry.hardFailures) ? entry.hardFailures : [],
						),
					)}`,
		),
		sub(
			'no-localhost-origin-in-jsonld-or-canonical',
			targetIsLocal
				? truncatedTargets.length > 0 || unobservedTargets.length > 0
					? 'unknown'
					: 'pass'
				: localhostFails.length > 0 || canonicalLocalhost
					? 'fail'
					: truncatedTargets.length > 0 || unobservedTargets.length > 0
						? 'unknown'
						: 'pass',
			targetIsLocal
				? `target host ${targetHost} is local; localhost origins accepted${
						truncatedTargets.length > 0
							? ` — body truncated for ${truncatedTargets.join(',')}; negative scan incomplete`
							: ''
					}`
				: `json-ld localhost hits=${localhostFails.length}; canonical localhost=${canonicalLocalhost || homeCanonicalLocalhost}${
						truncatedTargets.length > 0 || unobservedTargets.length > 0
							? `; negative scan incomplete (truncated=${truncatedTargets.join(',') || 'none'}, unobserved=${unobservedTargets.join(',') || 'none'})`
							: ''
					}`,
		),
	]
	return {
		id: 'marks-scan',
		title: 'CATALOG §3.2 mark scan + localhost origins',
		status: combine(subResults),
		required: true,
		unknownReason: combine(subResults) === 'unknown' ? 'indeterminate' : null,
		summary: `targets=${targets.length}; hard failures=${hardFailureCount}; warnings=${warningCount}; json-ld localhost=${localhostFails.length}; canonical localhost=${canonicalLocalhost || homeCanonicalLocalhost}${
			truncatedTargets.length > 0
				? `; TRUNCATED bodies (negative scans incomplete): ${truncatedTargets.join(',')}`
				: ''
		}`,
		sub: subResults,
		evidence: {
			targets: targetFindings,
			manifest: manifestEvidence,
			warningCount,
			hardFailureCount,
		},
	}
}

async function checkFinishLoop(
	options: Options,
	discovery: DiscoveryResult,
	productDayKeyValue: string,
	terminalPlan: TerminalPlan | null,
	serveAtMs: number,
): Promise<Check> {
	const checkId = 'finish-loop'
	if (!options.play) {
		return {
			id: checkId,
			title: 'finish loop (terminal + one-finish-per-day)',
			status: 'unknown',
			required: true,
			unknownReason: 'not_attempted',
			summary: 'not attempted: read-only mode (pass --play to write one guest finish)',
			sub: [sub('play-flag', 'unknown', '--play not set; the harness did not write')],
			evidence: {
				attempted: false,
				reason: 'read-only mode (--play not set); harness writes only with --play',
				guestId: options.guest,
			},
		}
	}
	if (!discovery.freeSlug) {
		return {
			id: checkId,
			title: 'finish loop (terminal + one-finish-per-day)',
			status: 'unknown',
			required: true,
			unknownReason: 'indeterminate',
			summary: 'free slug unknown; no terminal can be submitted',
			sub: [sub('free-slug-required', 'unknown', 'discovery did not yield exactly one free slug')],
			evidence: { attempted: true, guestId: options.guest, freeSlug: null },
		}
	}
	if (!terminalPlan) {
		return {
			id: checkId,
			title: 'finish loop (terminal + one-finish-per-day)',
			status: 'unknown',
			required: true,
			unknownReason: 'indeterminate',
			summary: `no honest terminal shape implemented for free slug ${discovery.freeSlug}`,
			sub: [
				sub(
					'terminal-shape',
					'unknown',
					`harness has no submission shape for ${discovery.freeSlug}`,
				),
			],
			evidence: { attempted: true, guestId: options.guest, freeSlug: discovery.freeSlug },
		}
	}
	const timeSpentMs = Math.max(1000, Date.now() - serveAtMs)
	const submissionJson = JSON.stringify(terminalPlan.data)
	const submissionJsonSha256 = await sha256Hex(submissionJson)
	const submitBody = (status: 'won' | 'lost'): Record<string, unknown> => ({
		gameSlug: discovery.freeSlug,
		status,
		attempts: 1,
		timeSpentMs,
		submissionJson,
		puzzleDate: productDayKeyValue,
	})

	// Pre-check: a reused guest with an accepted finish cannot produce a genuine
	// terminal; report it instead of pretending.
	const preRead = await connectUnary(
		options.base,
		'GetDaily',
		{ gameSlug: discovery.freeSlug, puzzleDate: productDayKeyValue },
		{ guestId: options.guest, timeoutMs: options.timeoutMs },
	)
	const preBody = asRecord(preRead.bodyJson)
	if (preBody?.hasCompleted === true) {
		const subResults = [
			sub(
				'pre-completion-state',
				'unknown',
				`guest ${options.guest} already has an accepted finish for ${discovery.freeSlug} ${productDayKeyValue}; use a fresh --guest`,
			),
		]
		return {
			id: checkId,
			title: 'finish loop (terminal + one-finish-per-day)',
			status: 'unknown',
			required: true,
			unknownReason: 'indeterminate',
			summary: `guest already completed ${discovery.freeSlug} ${productDayKeyValue}; finish loop not attempted`,
			sub: subResults,
			evidence: {
				attempted: true,
				guestId: options.guest,
				preRead: connectEvidence(preRead),
				reason: 'guest already has an accepted finish for this module/product day',
			},
		}
	}

	const attempts: Array<Record<string, unknown>> = []
	let submission = await connectUnary(
		options.base,
		'SubmitGuess',
		submitBody(terminalPlan.status),
		{
			guestId: options.guest,
			timeoutMs: options.timeoutMs,
		},
	)
	attempts.push(connectEvidence(submission))
	let submissionBody = asRecord(submission.bodyJson)
	let accepted = submissionBody?.valid === true
	// A rejected claim that says the terminal flipped (e.g. our unique-solution
	// solve did not match the server's stored solution, or a word-guess guess
	// hit the solution) is retried once with the opposite status. The server
	// stays the authority for the accepted terminal.
	const firstError = asString(submissionBody?.error) ?? ''
	if (!accepted && /Invalid (win|loss) claim/i.test(firstError)) {
		const flippedStatus = /loss claim/i.test(firstError) ? 'won' : 'lost'
		submission = await connectUnary(options.base, 'SubmitGuess', submitBody(flippedStatus), {
			guestId: options.guest,
			timeoutMs: options.timeoutMs,
		})
		attempts.push({ flippedStatus, ...connectEvidence(submission) })
		submissionBody = asRecord(submission.bodyJson)
		accepted = submissionBody?.valid === true
	}

	const reRead = await connectUnary(
		options.base,
		'GetDaily',
		{ gameSlug: discovery.freeSlug, puzzleDate: productDayKeyValue },
		{ guestId: options.guest, timeoutMs: options.timeoutMs },
	)
	const reBody = asRecord(reRead.bodyJson)
	const completedSession = asRecord(reBody?.completedSession)
	const second = await connectUnary(
		options.base,
		'SubmitGuess',
		submitBody((asString(submissionBody?.status) as 'won' | 'lost' | null) ?? terminalPlan.status),
		{ guestId: options.guest, timeoutMs: options.timeoutMs },
	)
	const secondRefused = second.httpStatus === 409 && second.connectMessage === 'already_played'
	const subResults: SubResult[] = [
		sub(
			'terminal-accepted',
			accepted ? 'pass' : 'fail',
			`SubmitGuess(${discovery.freeSlug}, plan=${terminalPlan.status}) → ${submission.httpStatus ?? submission.error}; valid=${String(
				submissionBody?.valid,
			)} status=${asString(submissionBody?.status) ?? '?'} error=${asString(submissionBody?.error) ?? 'none'}`,
		),
		sub(
			'completion-visible-on-reread',
			reRead.httpStatus === 200 && reBody?.hasCompleted === true && completedSession
				? 'pass'
				: reRead.httpStatus === null
					? 'unknown'
					: 'fail',
			`GetDaily re-read → ${reRead.httpStatus ?? reRead.error}; hasCompleted=${String(
				reBody?.hasCompleted,
			)} completedSession=${completedSession ? JSON.stringify(completedSession) : 'absent'}`,
		),
		sub(
			'second-finish-refused-already-played',
			second.httpStatus === null ? 'unknown' : secondRefused ? 'pass' : 'fail',
			`second SubmitGuess → ${second.httpStatus ?? second.error}:${second.connectMessage ?? '?'} (expect 409 already_played)`,
		),
	]
	return {
		id: checkId,
		title: 'finish loop (terminal + one-finish-per-day)',
		status: combine(subResults),
		required: true,
		unknownReason: null,
		summary: `${discovery.freeSlug}: plan=${terminalPlan.kind}/${terminalPlan.status}; SubmitGuess → ${
			submission.httpStatus ?? 'no response'
		} valid=${String(submissionBody?.valid)}; re-read hasCompleted=${String(reBody?.hasCompleted)}; second terminal → ${
			second.httpStatus ?? 'no response'
		}:${second.connectMessage ?? '?'}`,
		sub: subResults,
		evidence: {
			attempted: true,
			guestId: options.guest,
			gameSlug: discovery.freeSlug,
			productDayKey: productDayKeyValue,
			plan: {
				kind: terminalPlan.kind,
				status: terminalPlan.status,
				solver: terminalPlan.solver,
				submissionJsonBytes: submissionJson.length,
				submissionJsonSha256,
				submissionJsonNote:
					'terminal payload redacted from the report (sha256 identifies it) so the harness does not publish a solution',
			},
			submitRequests: attempts,
			reRead: connectEvidence(reRead),
			secondTerminal: connectEvidence(second),
			reReadCompletedSession: completedSession ?? null,
		},
	}
}

// ---------------------------------------------------------------------------
// Self-test (synthetic stubs; regression proof for the reviewed fixes)
// ---------------------------------------------------------------------------

type StubResponse = { status: number; headers?: Record<string, string>; body: string }

type StubConfig = {
	/** Replaces the default api health document. */
	healthz?: StubResponse
	/** Returns this status for every rotation GetDaily probe (e.g. 525). */
	rotationStatusAll?: number
	/** Free module slug (default sudoku; set word-guess for the unsolvable day). */
	freeSlug?: string
	/** puzzleDataJson served for the free module (default a unique sudoku). */
	puzzleDataJson?: string
	/** Exact path overrides (e.g. a share landing that redirects to /login). */
	routes?: Record<string, StubResponse>
	homeHtml?: string
}

type StubRequest = {
	method: string
	path: string
	headers: IncomingHttpHeaders
	body: string
}

type StubHandler = (request: StubRequest) => StubResponse

const STUB_SHA = '0123456789abcdef0123456789abcdef01234567'

/** Known unique-solution puzzle (classic fixture; also used by solver tests). */
const STUB_SUDOKU_GRID: Array<Array<number | null>> = [
	[5, 3, null, null, 7, null, null, null, null],
	[6, null, null, 1, 9, 5, null, null, null],
	[null, 9, 8, null, null, null, null, 6, null],
	[8, null, null, null, 6, null, null, null, 3],
	[4, null, null, 8, null, 3, null, null, 1],
	[7, null, null, null, 2, null, null, null, 6],
	[null, 6, null, null, null, null, 2, 8, null],
	[null, null, null, 4, 1, 9, null, null, 5],
	[null, null, null, null, 8, null, null, 7, 9],
]

function jsonStub(body: unknown, status = 200): StubResponse {
	return { status, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
}

function htmlStub(body: string, status = 200): StubResponse {
	return { status, headers: { 'content-type': 'text/html; charset=utf-8' }, body }
}

function defaultStubHomeHtml(origin: string, freeSlug: string): string {
	return `<!doctype html><html><head><title>Puzzled</title><link rel="canonical" href="${origin}/"/><link rel="manifest" href="/manifest.webmanifest"/></head><body><a href="/games/${freeSlug}">Play today</a></body></html>`
}

/** Minimal fake puzzled surface: only the routes the read-only checks touch. */
function makeStubConfigHandler(config: StubConfig): StubHandler {
	return ({ path, headers, body }) => {
		const host = headers.host ?? '127.0.0.1'
		const origin = `http://${host}`
		const freeSlug = config.freeSlug ?? 'sudoku'
		const dayKey = productDayKey()
		const override = config.routes?.[path]
		if (override) return override
		if (path === `${CONNECT_PREFIX}/GetDaily`) {
			if (config.rotationStatusAll) {
				return {
					status: config.rotationStatusAll,
					headers: { 'content-type': 'text/plain' },
					body: `error code: ${config.rotationStatusAll}`,
				}
			}
			const parsed = asRecord(safeJsonParse(body).value) ?? {}
			const slug = asString(parsed.gameSlug) ?? ''
			const requestedDate = asString(parsed.puzzleDate)
			if (requestedDate && requestedDate !== dayKey) {
				return jsonStub({ code: 'permission_denied', message: 'premium_required' }, 403)
			}
			if (slug === freeSlug) {
				return jsonStub({
					gameSlug: slug,
					puzzleNumber: 1,
					puzzleDate: dayKey,
					canPlay: true,
					mode: 'daily',
					slice: 'S2-daily-connect',
					puzzleDataJson:
						config.puzzleDataJson ??
						JSON.stringify({ difficulty: 'medium', grid: STUB_SUDOKU_GRID }),
				})
			}
			return jsonStub({ code: 'permission_denied', message: 'premium_required' }, 403)
		}
		if (path === `${CONNECT_PREFIX}/SubmitGuess`) {
			return jsonStub({ code: 'unimplemented', message: 'self-test is read-only' }, 501)
		}
		if (path === '/healthz') {
			return config.healthz ?? jsonStub({ status: 'ok', git_commit_sha: STUB_SHA })
		}
		if (path === '/readyz') {
			return jsonStub({
				status: 'ok',
				slice: 'S1',
				stub: false,
				git_commit_sha: STUB_SHA,
				dependencies: [{ name: 'postgres', ok: true, required: true, detail: 'self-test stub' }],
			})
		}
		if (path === '/') {
			return htmlStub(config.homeHtml ?? defaultStubHomeHtml(origin, freeSlug))
		}
		if (path === `/games/${freeSlug}`) {
			return htmlStub(`<!doctype html><html><body><h1>${freeSlug}</h1></body></html>`)
		}
		if (path.startsWith('/games/')) {
			return htmlStub('<html><body><a href="/pricing">Upgrade</a></body></html>')
		}
		if (path === '/pricing') return htmlStub('<!doctype html><html><body>Pricing</body></html>')
		if (path === '/login') return htmlStub('<!doctype html><html><body>Sign in</body></html>')
		if (path === '/manifest.webmanifest') {
			return jsonStub({ name: 'Puzzled', short_name: 'Puzzled', description: 'self-test stub' })
		}
		return jsonStub({ error: 'not_found', path }, 404)
	}
}

async function startStub(
	handler: StubHandler,
): Promise<{ base: string; stop: () => Promise<void> }> {
	const server = createServer((request, response) => {
		const chunks: Buffer[] = []
		request.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)))
		request.on('end', () => {
			const url = new URL(request.url ?? '/', 'http://127.0.0.1')
			let result: StubResponse
			try {
				result = handler({
					method: request.method ?? 'GET',
					path: url.pathname,
					headers: request.headers,
					body: Buffer.concat(chunks).toString('utf8'),
				})
			} catch (error) {
				result = jsonStub({ error: String(error) }, 500)
			}
			response.writeHead(result.status, { 'content-type': 'application/json', ...result.headers })
			response.end(result.body)
		})
	})
	await new Promise<void>((resolve) => {
		server.listen(0, '127.0.0.1', resolve)
	})
	const address = server.address()
	if (!address || typeof address === 'string') throw new Error('self-test stub failed to listen')
	return {
		base: `http://127.0.0.1:${address.port}`,
		stop: () =>
			new Promise<void>((resolve) => {
				server.close(() => resolve())
			}),
	}
}

type SelfTestCase = {
	id: string
	config: StubConfig
	expect: (report: Report) => string[]
}

const SELF_TEST_CASES: SelfTestCase[] = [
	{
		id: 'control-healthy-stub-goes-green',
		config: {},
		expect: (report) => {
			const problems: string[] = []
			if (!report.ok) {
				problems.push(`expected ok=true, got ok=false (${JSON.stringify(report.summary)})`)
			}
			for (const check of report.checks) {
				if (check.status === 'fail') problems.push(`${check.id} unexpectedly failed`)
				if (check.status === 'unknown' && check.unknownReason !== 'not_attempted') {
					problems.push(`${check.id} unexpectedly indeterminate`)
				}
			}
			return problems
		},
	},
	{
		// Reviewer F1 case 1: /healthz 200 without the api health document.
		id: 'f1-healthz-not-the-api-health-document-is-not-green',
		config: {
			healthz: { status: 200, headers: { 'content-type': 'text/plain' }, body: 'ok' },
		},
		expect: (report) => {
			const problems: string[] = []
			if (report.ok) problems.push('run is green although the health identity is unknown')
			if (report.liveRevision !== null) {
				problems.push(`liveRevision should be null, got ${report.liveRevision}`)
			}
			for (const id of ['healthz', 'readyz']) {
				const check = report.checks.find((entry) => entry.id === id)
				if (!check || check.status === 'pass') problems.push(`${id} should not pass`)
			}
			if (report.summary.indeterminate < 1) {
				problems.push('no indeterminate check recorded for the unknown health identity')
			}
			return problems
		},
	},
	{
		// Reviewer F1 case 2: every rotation probe 525 on both attempts.
		id: 'f1-rotation-525-both-attempts-is-not-green',
		config: { rotationStatusAll: 525 },
		expect: (report) => {
			const problems: string[] = []
			if (report.ok) problems.push('run is green although the rotation gate was never observed')
			const discovery = report.checks.find((entry) => entry.id === 'free-slug-discovery')
			if (!discovery) {
				problems.push('free-slug-discovery check missing')
			} else {
				if (discovery.status !== 'unknown') {
					problems.push(`free-slug-discovery should be unknown, got ${discovery.status}`)
				}
				const requests = (discovery.evidence as { requests?: unknown }).requests
				const first = Array.isArray(requests) ? requests[0] : null
				const attemptList =
					first && typeof first === 'object'
						? (first as { attempts?: Array<{ httpStatus?: number | null }> }).attempts
						: null
				if (!attemptList || attemptList.length !== 2) {
					problems.push(`expected 2 kept attempts per slug, got ${attemptList?.length ?? 'none'}`)
				} else if (attemptList.some((attempt) => attempt.httpStatus !== 525)) {
					problems.push('retry evidence does not record both 525 attempts')
				}
			}
			if (report.summary.fail !== 0) {
				const failing = report.checks
					.filter((entry) => entry.status === 'fail')
					.map((entry) => `${entry.id}(${entry.summary})`)
				problems.push(
					`expected no hard fails in this stub, got ${report.summary.fail}: ${failing.join('; ')}`,
				)
			}
			if (report.summary.indeterminate < 1) {
				problems.push('indeterminate count is 0 while the gate is unobserved')
			}
			return problems
		},
	},
	{
		// Reviewer F2 case 1: a deep link behind a login wall must not pass.
		id: 'f2-share-redirect-to-login-fails',
		config: {
			routes: {
				'/games/sudoku': { status: 302, headers: { location: '/login' }, body: '' },
				'/login': htmlStub('<!doctype html><html><body>Sign in</body></html>'),
			},
		},
		expect: (report) => {
			const problems: string[] = []
			const share = report.checks.find((entry) => entry.id === 'share-deep-link')
			if (!share) return ['share-deep-link check missing']
			if (share.status !== 'fail') problems.push(`share-deep-link should fail, got ${share.status}`)
			const finalPath = (share.evidence as { finalPath?: string | null }).finalPath
			if (finalPath !== '/login') problems.push(`expected finalPath /login, got ${finalPath}`)
			if (report.ok) problems.push('run is green although the share landing was a login wall')
			return problems
		},
	},
	{
		// Reviewer F2 case 2: no local solution => leak compare is unknown, not pass.
		id: 'f2-share-leak-compare-unknown-without-solution',
		config: {
			freeSlug: 'word-guess',
			puzzleDataJson: JSON.stringify({ wordLength: 5, maxAttempts: 6 }),
		},
		expect: (report) => {
			const problems: string[] = []
			const share = report.checks.find((entry) => entry.id === 'share-deep-link')
			if (!share) return ['share-deep-link check missing']
			if (share.status !== 'unknown') {
				problems.push(`share-deep-link should be unknown, got ${share.status}`)
			}
			const signatureSub = share.sub.find((entry) => entry.id === 'landing-no-solution-signature')
			if (signatureSub?.status !== 'unknown') {
				problems.push(
					`landing-no-solution-signature should be unknown, got ${signatureSub?.status}`,
				)
			}
			if (report.ok) problems.push('run is green although the grid-leak compare was not performed')
			return problems
		},
	},
	{
		// Reviewer F3: an empty puzzle payload is not a served puzzle.
		id: 'f3-empty-puzzle-payload-fails',
		config: { puzzleDataJson: '{}' },
		expect: (report) => {
			const problems: string[] = []
			const serve = report.checks.find((entry) => entry.id === 'daily-serve')
			if (!serve) return ['daily-serve check missing']
			if (serve.status !== 'fail') problems.push(`daily-serve should fail, got ${serve.status}`)
			const payloadSub = serve.sub.find((entry) => entry.id === 'puzzle-data-json')
			if (payloadSub?.status !== 'fail') {
				problems.push(`puzzle-data-json should fail, got ${payloadSub?.status}`)
			}
			if (report.ok) problems.push('run is green although the free module carried no puzzle')
			return problems
		},
	},
	{
		// Reviewer F5: a >4 MiB page cannot green a whole-document negative scan
		// (the forbidden mark sits past the body cap).
		id: 'f5-truncated-body-cannot-green-negative-scans',
		config: {
			homeHtml: `<html><head><title>Puzzled</title><link rel="canonical" href="http://localhost/"/><link rel="manifest" href="/manifest.webmanifest"/></head><body><a href="/games/sudoku">Play</a>${'x'.repeat(
				MAX_BODY_BYTES + 1024,
			)}<meta name="keywords" content="wordle"></body></html>`,
		},
		expect: (report) => {
			const problems: string[] = []
			const marks = report.checks.find((entry) => entry.id === 'marks-scan')
			if (!marks) return ['marks-scan check missing']
			if (marks.status !== 'unknown') {
				problems.push(`marks-scan should be unknown, got ${marks.status}`)
			}
			const targets = (marks.evidence as { targets?: Array<{ bodyTruncated?: boolean }> }).targets
			if (!targets?.[0]?.bodyTruncated) {
				problems.push('home target was not recorded as body-truncated')
			}
			if (report.ok) {
				problems.push('run is green although the mark scan only saw a truncated body')
			}
			return problems
		},
	},
]

async function runSelfTest(): Promise<number> {
	console.log(`verify-live --self-test (${SELF_TEST_CASES.length} synthetic stub cases)`)
	let failures = 0
	for (const testCase of SELF_TEST_CASES) {
		const stub = await startStub(makeStubConfigHandler(testCase.config))
		try {
			const options: Options = {
				base: stub.base,
				play: false,
				guest: crypto.randomUUID(),
				guestProvided: false,
				json: true,
				timeoutMs: 5_000,
				expectedSha: null,
				selfTest: false,
			}
			const { report } = await runReport(options)
			const exitCode = report.ok ? 0 : 1
			const problems = testCase.expect(report)
			if (problems.length === 0) {
				console.log(
					`[selftest][pass] ${testCase.id} — ok=${report.ok} exit=${exitCode} ${JSON.stringify(report.summary)}`,
				)
			} else {
				failures += 1
				console.log(`[selftest][FAIL] ${testCase.id} — ${problems.join('; ')}`)
			}
		} finally {
			await stub.stop()
		}
	}
	console.log(
		failures === 0
			? `[selftest] all ${SELF_TEST_CASES.length} cases behaved as expected`
			: `[selftest] ${failures}/${SELF_TEST_CASES.length} cases FAILED`,
	)
	return failures === 0 ? 0 : 1
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<number> {
	const parsed = parseOptions(process.argv.slice(2))
	if (parsed === 'help') {
		printHelp()
		return 0
	}
	if ('error' in parsed) {
		console.error(`verify-live: ${parsed.error}`)
		console.error('run with --help for usage')
		return 2
	}
	if (parsed.selfTest) {
		return runSelfTest()
	}
	const { report } = await runReport(parsed)
	printReport(report, parsed)
	return report.ok ? 0 : 1
}

/**
 * Run every check and derive the run verdict.
 *
 * Verdict rule (reviewer F1): an `unknown` check only leaves the run green when
 * it explicitly labels itself `not_attempted` (the read-only finish loop). Any
 * other unknown — including a check that went unknown because its evidence was
 * missing — is indeterminate and fails the machine verdict.
 */
async function runReport(options: Options): Promise<{ report: Report }> {
	const observedAt = new Date().toISOString()

	const checks: Check[] = []
	const healthz = await checkHealthz(options.base, options.timeoutMs, options.expectedSha)
	const healthzSha = asString(healthz.evidence.gitCommitSha)
	const readyz = await checkReadyz(options.base, healthzSha, options.timeoutMs)
	const discovery = await checkFreeSlugDiscovery(options)
	const serve = await checkDailyServe(discovery, options.guest, options.guestProvided)
	const web = await checkWebDocument(options, discovery)
	const productDayKeyValue = discovery.productDayKeyFromServer ?? productDayKey()
	const productDayKeySource = discovery.productDayKeyFromServer
		? 'server GetDaily puzzleDate'
		: 'local Asia/Hong_Kong (UTC+8)'
	const terminalPlan = discovery.puzzleData
		? discovery.freeSlug
			? buildTerminalPlan(discovery.freeSlug, discovery.puzzleData)
			: null
		: null
	const share = await checkShareDeepLink(
		options,
		discovery,
		productDayKeyValue,
		productDayKeySource,
		terminalPlan,
	)
	const premium = await checkPremiumFailClosed(options, discovery, productDayKeyValue)
	const marks = await checkMarksScan(options, discovery, web.result, web.canonicalLocalhost)
	const finish = await checkFinishLoop(
		options,
		discovery,
		productDayKeyValue,
		terminalPlan,
		discovery.observedAtMs,
	)

	// Stable report order: the required check list, not execution order.
	checks.push(
		healthz,
		readyz,
		web.check,
		discovery.check,
		serve,
		share.check,
		premium,
		marks,
		finish,
	)
	const finalized = checks.map(finalizeCheck)
	const failures = finalized.filter((entry) => entry.status === 'fail')
	const notAttempted = finalized.filter(
		(entry) => entry.status === 'unknown' && entry.unknownReason === 'not_attempted',
	)
	// Derived from status, not from the optional label: a check that reports
	// unknown without an explicit not-attempted exemption is indeterminate.
	const indeterminate = finalized.filter(
		(entry) => entry.status === 'unknown' && entry.unknownReason !== 'not_attempted',
	)
	const ok = failures.length === 0 && indeterminate.length === 0
	const summary = {
		pass: finalized.filter((entry) => entry.status === 'pass').length,
		fail: failures.length,
		unknown: finalized.filter((entry) => entry.status === 'unknown').length,
		notAttempted: notAttempted.length,
		indeterminate: indeterminate.length,
	}
	const report: Report = {
		base: options.base,
		observedAt,
		liveRevision: healthzSha,
		expectedRevision: options.expectedSha,
		productDayKey: productDayKeyValue,
		productDayKeySource,
		mode: options.play ? 'play (writes one guest finish)' : 'read-only',
		guestId: options.guest,
		ok,
		summary,
		checks: finalized,
	}
	return { report }
}

function printReport(report: Report, options: Options): void {
	const { checks } = report
	if (options.json) {
		console.log(JSON.stringify(report, null, 2))
	} else {
		console.log(`puzzled live verification — ${report.base}`)
		console.log(`observedAt    ${report.observedAt}`)
		console.log(`liveRevision  ${report.liveRevision ?? 'unknown'} (healthz git_commit_sha)`)
		if (report.expectedRevision) {
			console.log(
				`expectedSha   ${report.expectedRevision} (${
					report.liveRevision && shaMatches(report.liveRevision, report.expectedRevision)
						? 'matched'
						: 'MISMATCH'
				})`,
			)
		}
		console.log(`productDayKey ${report.productDayKey} (${report.productDayKeySource})`)
		console.log(`guestId       ${report.guestId}`)
		console.log(`mode          ${report.mode}`)
		console.log('')
		for (const check of checks) {
			console.log(`[${check.status}] ${check.id} — ${check.summary}`)
			for (const entry of check.sub) {
				console.log(`        [${entry.status}] ${entry.id}: ${entry.detail}`)
			}
		}
		console.log('')
		console.log(
			`summary: ${report.summary.pass} pass, ${report.summary.fail} fail, ${report.summary.unknown} unknown (${report.summary.notAttempted} not attempted, ${report.summary.indeterminate} indeterminate) → exit ${report.ok ? 0 : 1}`,
		)
		console.log(
			'evidence layer: Live (observed behavior of the target-reported revision); no Deployed/Released identity is claimed.',
		)
	}
}

if (import.meta.main) {
	const exitCode = await main()
	process.exit(exitCode)
}
