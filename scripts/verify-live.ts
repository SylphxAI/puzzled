#!/usr/bin/env bun

/**
 * verify-live.ts — re-runnable Live-layer readbacks for the Puzzled capability
 * graph (PUZ-MODULE / PUZ-DAILY / PUZ-FREE / PUZ-SHARE / PUZ-MARKS).
 *
 * Layer: Live (owner standards/docs.md, "Claims stay inside their layer") for the revision the
 * target itself reports. Source/CI/Deploy layers are NOT established here, and
 * a green-looking proxy never upgrades a check.
 *
 * Every check reports pass / fail / unknown together with the raw evidence that
 * supports it (HTTP status, timing, response excerpts, SHA-256 fingerprints and
 * the git_commit_sha the target reports on /healthz).
 *
 * Read-only by default. `--play` bootstraps a fresh guest, explicitly starts
 * three games, probes the fourth when Plus is on sale, and verifies one finish
 * and its duplicate refusal. Use only on a target approved for synthetic writes.
 *
 * Usage:
 *   bun scripts/verify-live.ts                                  # read-only, live
 *   bun scripts/verify-live.ts --base https://tryit.fun --json
 *   bun scripts/verify-live.ts --play                            # claims picks and writes one finish
 *   bun scripts/verify-live.ts --base https://example.com --json
 */

import type { IncomingHttpHeaders } from 'node:http'
import { createServer } from 'node:http'

// ---------------------------------------------------------------------------
// Constants (contracts this harness asserts against)
// ---------------------------------------------------------------------------

const DEFAULT_BASE = 'https://tryit.fun'
const DEFAULT_TIMEOUT_MS = 20_000
/** Hard cap on any response body read (defensive; product pages are ~150 KB). */
const MAX_BODY_BYTES = 4 * 1024 * 1024
const CONNECT_PREFIX = '/puzzled.v1.PuzzleService'

/** Featured order only, not an access rule (game_slugs.rs FREE_GAME_ROTATION). */
const FEATURED_ROTATION = ['word-guess', 'word-groups', 'crowns', 'sudoku', 'crossword'] as const
/** Mirrors game_slugs.rs VALID_SLUGS; deliberately covers games outside the featured order. */
const GAME_SLUGS = [
	'word-guess',
	'word-groups',
	'word-hive',
	'crossword',
	'sudoku',
	'nonogram',
	'word-ladder',
	'arithmo',
	'pattern-match',
	'block-slide',
	'crowns',
	'duo',
	'word-box',
	'quad-words',
	'killer-sudoku',
	'cryptogram',
	'word-search',
	'number-path',
	'pip-place',
] as const
// A stable, solvable finish target independent of which game the homepage features.
const PLAY_SLUG = 'sudoku'
const PICK_PROBE_SLUGS = [PLAY_SLUG, 'word-guess', 'nonogram', 'crowns'] as const

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
 * the docs/catalog.md "Names" marks we do not use (player title or slug). The harness scans
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
	json: boolean
	timeoutMs: number
	expectedSha: string | null
	selfTest: boolean
	/** Pinned clock for the self-test; live runs use the host clock. */
	now?: Date
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
	mode: 'read-only' | 'play (claims picks and writes one guest finish)'
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
  --play            start three games, probe the fourth when Plus is on sale,
                    and write ONE guest finish (default: read-only)
  --guest <uuid>    report correlation label, not a credential (default: random)
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
remains; 0 otherwise. Read-only mode skips starts, finishing, and the
share-solution signature comparison (unknown/not_attempted).

Evidence layer: Live (observed behavior of the target's own reported revision).
`)
}

function parseOptions(argv: string[]): Options | 'help' | { error: string } {
	const opts: Options = {
		base: DEFAULT_BASE,
		play: false,
		guest: crypto.randomUUID(),
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
 * `not_attempted` (only the explicit read-only exemptions does). A check that went
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

async function mintGuestSessionCookie(
	base: string,
	timeoutMs: number,
): Promise<{ cookie: string | null; status: number | null; error: string | null }> {
	const origin = new URL(base).origin
	try {
		const response = await fetch(`${base}/v1/guest/session`, {
			method: 'POST',
			redirect: 'manual',
			headers: {
				'content-type': 'application/json',
				accept: 'application/json',
				origin,
				'sec-fetch-site': 'same-origin',
				'user-agent': 'puzzled-verify-live/1 (SylphxAI/puzzled scripts/verify-live.ts)',
			},
			body: '{}',
			signal: AbortSignal.timeout(timeoutMs),
		})
		const setCookies =
			typeof response.headers.getSetCookie === 'function'
				? response.headers.getSetCookie()
				: [response.headers.get('set-cookie')].filter((v): v is string => Boolean(v))
		const guestPair =
			setCookies
				.map((raw) => raw.split(';')[0]?.trim() ?? '')
				.find((pair) => /^__Host-puzzled_guest=[^;\s]+$/.test(pair)) ?? null
		await response.body?.cancel().catch(() => {})
		return {
			cookie: response.ok ? guestPair : null,
			status: response.status,
			error: response.ok && guestPair ? null : `/v1/guest/session status=${response.status}`,
		}
	} catch (error) {
		return {
			cookie: null,
			status: null,
			error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
		}
	}
}

async function connectUnary(
	base: string,
	method: string,
	body: Record<string, unknown>,
	options: { guestCookie?: string | null; timeoutMs: number },
): Promise<ConnectResult> {
	const headers: Record<string, string> = {
		'content-type': 'application/json',
		'connect-protocol-version': '1',
		'x-puzzled-verification': '1',
		accept: 'application/json',
	}
	if (options.guestCookie) {
		headers.cookie = options.guestCookie
		headers.origin = new URL(base).origin
		headers['sec-fetch-site'] = 'same-origin'
	}
	const result = await httpRequest(`${base}${CONNECT_PREFIX}/${method}`, {
		method: 'POST',
		redirect: 'manual',
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

type DailyProbe = { slug: string; result: ConnectResult; attempts: ConnectResult[] }
type DiscoveryResult = {
	check: Check
	featuredSlug: string
	productDayKeyFromServer: string | null
	probes: DailyProbe[]
}

/** Featured suggestion, determined by ordinal0 (Jan 1 = 0), not a free-game gate. */
export function featuredSlugForDayKey(dayKey: string): string {
	const [year, month, day] = dayKey.split('-').map(Number)
	const ordinal0 = Math.round((Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 1)) / 86_400_000)
	return FEATURED_ROTATION[ordinal0 % FEATURED_ROTATION.length]
}

function httpStatusCheck(result: { httpStatus: number | null }, expected: number): CheckStatus {
	return result.httpStatus === null || result.httpStatus >= 500
		? 'unknown'
		: result.httpStatus === expected
			? 'pass'
			: 'fail'
}

/** Proto3 omits false. A failed/malformed RPC is not evidence that sales are closed. */
async function readSalesOpen(base: string, timeoutMs: number) {
	const result = await httpRequest(`${base}/puzzled.v1.BillingService/ListPlans`, {
		method: 'POST',
		redirect: 'manual',
		headers: {
			'content-type': 'application/json',
			'connect-protocol-version': '1',
			accept: 'application/json',
		},
		body: '{}',
		timeoutMs,
	})
	const body = asRecord(result.bodyJson)
	const salesOpen =
		result.httpStatus === 200 &&
		!result.bodyTruncated &&
		body &&
		(body.salesOpen === undefined || typeof body.salesOpen === 'boolean')
			? body.salesOpen === true
			: null
	return { salesOpen, result }
}

async function checkFreeSlugDiscovery(options: Options): Promise<DiscoveryResult> {
	const localDayKey = productDayKey(options.now ?? new Date())
	const featuredSlug = featuredSlugForDayKey(localDayKey)
	const probes: DailyProbe[] = []
	for (const slug of GAME_SLUGS) {
		const probe = () =>
			connectUnary(
				options.base,
				'GetDaily',
				{ gameSlug: slug },
				{
					timeoutMs: options.timeoutMs,
				},
			)
		const attempts = [await probe()]
		// Keep both attempts; never count a 5xx as evidence about the product contract.
		if (httpStatusCheck(attempts[0], 200) === 'unknown') attempts.push(await probe())
		probes.push({ slug, result: attempts[attempts.length - 1], attempts })
	}
	const subResults = probes.map(({ slug, result, attempts }) =>
		sub(
			`get-daily-${slug}`,
			httpStatusCheck(result, 200),
			`anonymous GetDaily(${slug}) → ${result.httpStatus ?? result.error}:${result.connectMessage ?? ''} (${attempts.length} attempt(s))`,
		),
	)
	const featured = probes.find(({ slug }) => slug === featuredSlug)?.result
	const date =
		featured?.httpStatus === 200 ? asString(asRecord(featured.bodyJson)?.puzzleDate) : null
	return {
		check: {
			id: 'free-slug-discovery',
			title: 'anonymous daily metadata is available for every game',
			status: combine(subResults),
			required: true,
			unknownReason: null,
			summary: `${subResults.filter((entry) => entry.status === 'pass').length}/${GAME_SLUGS.length} catalog games returned HTTP 200; homepage suggestion = ${featuredSlug}`,
			sub: subResults,
			evidence: {
				featuredSlug,
				expectedLocalProductDayKey: localDayKey,
				requests: probes.map(({ slug, attempts }) => ({
					slug,
					attempts: attempts.map(connectEvidence),
				})),
			},
		},
		featuredSlug,
		productDayKeyFromServer: date === localDayKey ? date : null,
		probes,
	}
}

function scanLeakKeys(value: unknown, path: string, findings: string[]): void {
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
			findings.push(`${path}.${key}`)
		}
		scanLeakKeys(entry, `${path}.${key}`, findings)
	}
}

function checkDailyServe(discovery: DiscoveryResult, dayKey: string): Check {
	const subResults = discovery.probes.map(({ slug, result }) => {
		const body = asRecord(result.bodyJson)
		const leakFindings: string[] = []
		scanLeakKeys(body, '$', leakFindings)
		const shapeOk =
			!result.bodyTruncated &&
			body?.gameSlug === slug &&
			body?.puzzleDate === dayKey &&
			body.requiresStart === true &&
			body.canPlay === true &&
			!('puzzleDataJson' in body) &&
			(body.hasCompleted === undefined || body.hasCompleted === false) &&
			!('completedSession' in body) &&
			body.stub !== true &&
			leakFindings.length === 0
		const httpStatus = httpStatusCheck(result, 200)
		return sub(
			`cold-metadata-${slug}`,
			httpStatus !== 'pass' ? httpStatus : shapeOk ? 'pass' : 'fail',
			`puzzleDate=${String(body?.puzzleDate)} (expect ${dayKey}); requiresStart=${String(body?.requiresStart)} canPlay=${String(body?.canPlay)}; board present=${body !== null && 'puzzleDataJson' in body}; leaked keys=${leakFindings.join(',')}`,
		)
	})
	return {
		id: 'daily-serve',
		title: 'cold GetDaily does not serve a board or an answer',
		status: combine(subResults),
		required: true,
		unknownReason: null,
		summary: `${subResults.filter((entry) => entry.status === 'pass').length}/${GAME_SLUGS.length} games advertised an unstarted, playable daily for ${dayKey} (Asia/Hong_Kong) without a board`,
		sub: subResults,
		evidence: { expectedProductDayKey: dayKey },
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
	const featuredGameHrefs = discovery.featuredSlug
		? hrefs.filter((href) =>
				ctaHrefMatches(href, discovery.featuredSlug as string, options.base, targetHostWithPort),
			)
		: []
	const rejectedGameHrefs = discovery.featuredSlug
		? gamesHrefs.filter((href) => !featuredGameHrefs.includes(href))
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
			discovery.featuredSlug ? (featuredGameHrefs.length > 0 ? 'pass' : 'fail') : 'unknown',
			discovery.featuredSlug
				? `featured slug=${discovery.featuredSlug}; hrefs to /games/${discovery.featuredSlug}: ${featuredGameHrefs.length}; all /games/ hrefs: ${gamesHrefs.length}`
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
			}; featured-game hrefs=${featuredGameHrefs.length}`,
			sub: subResults,
			evidence: {
				...httpEvidence(result),
				canonical,
				canonicalLocalhost,
				targetHost,
				targetIsLocal,
				freeSlug: discovery.featuredSlug,
				featuredGameHrefs,
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
	signatureCheck: Check
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
	slug: string,
	productDayKeyValue: string,
	productDayKeySource: string,
	terminalPlan: TerminalPlan | null,
): Promise<ShareResult> {
	const path = `/games/${slug}?date=${productDayKeyValue}`
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
	const onModulePath = finalPath !== null && pathIsModulePath(finalPath, slug)
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
	]
	const signatureSub = sub(
		'landing-no-solution-signature',
		!options.play ||
			!finalOk ||
			!finalHtml ||
			final.bodyTruncated ||
			solutionSignatures.length === 0
			? 'unknown'
			: solutionSignatureHits.length > 0
				? 'fail'
				: 'pass',
		!options.play
			? 'read-only mode did not start a game or solve a board'
			: !finalOk || !finalHtml || final.bodyTruncated
				? 'no complete share landing to compare'
				: solutionSignatures.length === 0
					? 'no unique locally solved signature; grid-leak comparison not performed'
					: `${solutionSignatures.length} locally solved signature(s) checked; hits=${solutionSignatureHits.length}`,
	)
	return {
		signatureCheck: {
			id: 'share-solution-signature',
			title: 'share landing omits the locally solved grid',
			status: signatureSub.status,
			required: true,
			unknownReason: !options.play ? 'not_attempted' : null,
			summary: signatureSub.detail,
			sub: [signatureSub],
			evidence: {
				solutionSignatureCount: solutionSignatures.length,
				solutionSignatureSha256s,
				solutionSignatureHits: solutionSignatureHits.length,
			},
		},
		check: {
			id: 'share-deep-link',
			title: 'share / deep link (non-spoiler)',
			status: combine(subResults),
			required: true,
			unknownReason: combine(subResults) === 'unknown' ? 'indeterminate' : null,
			summary: `GET ${path} → ${first.httpStatus ?? 'no response'}${
				first.location ? ` → ${final.httpStatus}` : ''
			}; final path=${finalPath ?? 'unparsed'}(module=${onModulePath}); product day key ${productDayKeyValue} (${productDayKeySource})${
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
			},
		},
	}
}

async function checkArchiveOpen(
	options: Options,
	discovery: DiscoveryResult,
	productDayKeyValue: string,
	billing: Awaited<ReturnType<typeof readSalesOpen>>,
): Promise<Check> {
	const { salesOpen } = billing
	const pastDate = shiftDayKey(productDayKeyValue, -1)
	const futureDate = shiftDayKey(productDayKeyValue, 2)
	const archiveSlug = discovery.featuredSlug
	const archive = await connectUnary(
		options.base,
		'GetDaily',
		{ gameSlug: archiveSlug, puzzleDate: pastDate },
		{ timeoutMs: options.timeoutMs },
	)
	const future = await connectUnary(
		options.base,
		'GetDaily',
		{ gameSlug: archiveSlug, puzzleDate: futureDate },
		{ timeoutMs: options.timeoutMs },
	)
	const futureRefused = future.httpStatus === 400 && future.connectMessage === 'future_puzzle_date'
	const subResults: SubResult[] = [
		sub(
			'anonymous-archive-access',
			salesOpen === null || httpStatusCheck(archive, 200) === 'unknown'
				? 'unknown'
				: salesOpen
					? archive.httpStatus === 403 && archive.connectMessage === 'plus_required_archive'
						? 'pass'
						: 'fail'
					: archive.httpStatus === 200 && asRecord(archive.bodyJson)?.puzzleDate === pastDate
						? 'pass'
						: 'fail',
			`anonymous GetDaily(${archiveSlug}, puzzleDate=${pastDate}) → ${archive.httpStatus ?? archive.error}${
				archive.connectMessage ? `:${archive.connectMessage}` : ''
			}`,
		),
		sub(
			'future-date-refused-400',
			future.httpStatus === null || future.httpStatus >= 500
				? 'unknown'
				: futureRefused
					? 'pass'
					: 'fail',
			`anonymous GetDaily(${archiveSlug}, puzzleDate=${futureDate}) → ${future.httpStatus ?? future.error}:${
				future.connectMessage ?? '?'
			} (expected 400 future_puzzle_date)`,
		),
	]
	return {
		id: 'archive-open',
		title: 'archive access follows Plus sales; future refused',
		status: combine(subResults),
		required: true,
		unknownReason: null,
		summary: `archive ${archiveSlug}@${pastDate} → ${archive.httpStatus ?? 'no response'}; future ${archiveSlug}@${futureDate} → ${
			future.httpStatus ?? 'no response'
		}:${future.connectMessage ?? '?'}`,
		sub: subResults,
		evidence: {
			salesOpen,
			listPlans: httpEvidence(billing.result),
			archiveRequest: { gameSlug: archiveSlug, puzzleDate: pastDate, ...connectEvidence(archive) },
			futureRequest: { gameSlug: archiveSlug, puzzleDate: futureDate, ...connectEvidence(future) },
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
	if (discovery.featuredSlug) {
		const game = await httpRequest(`${options.base}/games/${discovery.featuredSlug}`, {
			headers: { accept: 'text/html,application/xhtml+xml' },
			timeoutMs: options.timeoutMs,
		})
		gameHtml = game.bodyText || null
		targets.push({
			url: `${options.base}/games/${discovery.featuredSlug}`,
			label: `games/${discovery.featuredSlug}`,
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

type PlayStart = {
	check: Check
	started: {
		cookie: string
		puzzle: Record<string, unknown>
		puzzleData: Record<string, unknown>
		observedAtMs: number
	} | null
}

function skippedWrite(id: string, title: string, detail: string, readOnly: boolean): Check {
	return {
		id,
		title,
		status: 'unknown',
		required: true,
		unknownReason: readOnly ? 'not_attempted' : 'indeterminate',
		summary: detail,
		sub: [],
		evidence: { attempted: false },
	}
}

async function checkStartDaily(
	options: Options,
	discovery: DiscoveryResult,
	coldCheck: Check,
	dayKey: string,
	salesOpen: boolean | null,
): Promise<PlayStart> {
	const id = 'start-daily'
	const title = 'explicit guest starts and three-pick limit'
	if (!options.play || coldCheck.status !== 'pass' || salesOpen === null) {
		return {
			check: skippedWrite(
				id,
				title,
				!options.play
					? 'read-only: no guest bootstrap, no starts, no fourth-pick probe'
					: 'start not attempted: cold metadata or Plus sales state was not established',
				!options.play,
			),
			started: null,
		}
	}
	const session = await mintGuestSessionCookie(options.base, options.timeoutMs)
	const results = [
		sub(
			'guest-session-bootstrap',
			session.cookie
				? 'pass'
				: httpStatusCheck({ httpStatus: session.status }, 200) === 'unknown'
					? 'unknown'
					: 'fail',
			session.error ?? 'server-issued guest cookie received (not recorded)',
		),
	]
	const requests: Record<string, unknown>[] = []
	let started: PlayStart['started'] = null
	if (session.cookie) {
		for (const [index, slug] of PICK_PROBE_SLUGS.entries()) {
			const fourth = index === 3
			if (fourth && !salesOpen) break
			const cold = discovery.probes.find((probe) => probe.slug === slug)?.result.bodyJson
			const request = {
				gameSlug: slug,
				difficulty: asString(asRecord(cold)?.difficulty) ?? '',
				puzzleDate: dayKey,
			}
			const response = await connectUnary(options.base, 'StartDaily', request, {
				guestCookie: session.cookie,
				timeoutMs: options.timeoutMs,
			})
			const envelope = asRecord(response.bodyJson)
			const daily = asRecord(envelope?.daily)
			const payload = asString(daily?.puzzleDataJson)
			const puzzleData = payload ? asRecord(safeJsonParse(payload).value) : null
			const leakFindings: string[] = []
			scanLeakKeys(envelope, '$', leakFindings)
			scanLeakKeys(puzzleData, '$.daily.puzzleDataJson', leakFindings)
			const expectedStatus = fourth ? 403 : 200
			const http = httpStatusCheck(response, expectedStatus)
			const valid =
				!response.bodyTruncated &&
				leakFindings.length === 0 &&
				(fourth
					? response.connectMessage === 'plus_required' &&
						envelope !== null &&
						!('daily' in envelope) &&
						!('puzzleDataJson' in envelope)
					: daily?.gameSlug === slug &&
						daily.puzzleDate === dayKey &&
						daily.canPlay === true &&
						(daily.requiresStart === undefined || daily.requiresStart === false) &&
						(daily.hasCompleted === undefined || daily.hasCompleted === false) &&
						daily.stub !== true &&
						puzzleData !== null &&
						Object.keys(puzzleData).length > 0)
			const status = http === 'pass' ? (valid ? 'pass' : 'fail') : http
			results.push(
				sub(
					fourth ? 'fourth-pick-refused' : `start-${slug}`,
					status,
					`StartDaily(${slug}, ${dayKey}) → ${response.httpStatus ?? response.error}:${response.connectMessage ?? ''}; ${fourth ? 'expect 403 plus_required without a board' : `expect playable nested daily with a board; keys=${Object.keys(puzzleData ?? {}).join(',')}`}`,
				),
			)
			requests.push({
				request,
				...connectEvidence(response),
				leakKeyPaths: leakFindings,
			})
			// Do not make more writes after a failed or uncertain start.
			if (status !== 'pass') break
			if (slug === PLAY_SLUG && daily && puzzleData) {
				started = { cookie: session.cookie, puzzle: daily, puzzleData, observedAtMs: Date.now() }
			}
		}
	}
	const status = combine(results)
	return {
		check: {
			id,
			title,
			status,
			required: true,
			unknownReason: null,
			sub: results,
			summary: `${requests.length} explicit start request(s); fourth-pick probe ${salesOpen ? 'required while Plus is on sale' : 'not applicable (Plus not on sale)'}`,
			evidence: { guestSessionStatus: session.status, salesOpen, requests },
		},
		started: status === 'pass' ? started : null,
	}
}

async function checkFinishLoop(
	options: Options,
	started: PlayStart['started'],
	productDayKeyValue: string,
	terminalPlan: TerminalPlan | null,
): Promise<Check> {
	const checkId = 'finish-loop'
	const title = 'finish loop (terminal + one-finish-per-day)'
	if (!started || !terminalPlan) {
		return skippedWrite(
			checkId,
			title,
			!options.play
				? 'read-only: no terminal submitted'
				: 'no terminal submitted: verified StartDaily board or terminal plan missing',
			!options.play,
		)
	}
	const { cookie: guestCookie, puzzle, observedAtMs } = started
	const timeSpentMs = Math.max(1000, Date.now() - observedAtMs)
	const submissionJson = JSON.stringify(terminalPlan.data)
	const submissionJsonSha256 = await sha256Hex(submissionJson)
	const difficulty = asString(puzzle.difficulty) ?? ''
	const puzzleId = asString(puzzle.puzzleId)
	const submitBody = (status: 'won' | 'lost'): Record<string, unknown> => ({
		gameSlug: PLAY_SLUG,
		difficulty,
		...(puzzleId ? { puzzleId } : {}),
		status,
		attempts: 1,
		timeSpentMs,
		submissionJson,
		puzzleDate: productDayKeyValue,
	})

	const attempts: Array<Record<string, unknown>> = []
	let submission = await connectUnary(
		options.base,
		'SubmitGuess',
		submitBody(terminalPlan.status),
		{
			guestCookie,
			timeoutMs: options.timeoutMs,
		},
	)
	attempts.push({ ...connectEvidence(submission), bodyExcerpt: null })
	let submissionBody = asRecord(submission.bodyJson)
	let accepted =
		submission.httpStatus === 200 && !submission.bodyTruncated && submissionBody?.valid === true
	// A rejected claim that says the terminal flipped (e.g. our unique-solution
	// solve did not match the server's stored solution) is retried once with
	// the opposite status. The server
	// stays the authority for the accepted terminal.
	const firstError = asString(submissionBody?.error) ?? ''
	if (
		submission.httpStatus === 200 &&
		!submission.bodyTruncated &&
		submissionBody?.valid === false &&
		/Invalid (win|loss) claim/i.test(firstError)
	) {
		const flippedStatus = /loss claim/i.test(firstError) ? 'won' : 'lost'
		submission = await connectUnary(options.base, 'SubmitGuess', submitBody(flippedStatus), {
			guestCookie,
			timeoutMs: options.timeoutMs,
		})
		attempts.push({ flippedStatus, ...connectEvidence(submission), bodyExcerpt: null })
		submissionBody = asRecord(submission.bodyJson)
		accepted =
			submission.httpStatus === 200 && !submission.bodyTruncated && submissionBody?.valid === true
	}

	if (!accepted) {
		const status = httpStatusCheck(submission, 200) === 'unknown' ? 'unknown' : 'fail'
		return {
			id: checkId,
			title,
			status,
			required: true,
			unknownReason: null,
			summary: 'terminal acceptance was not observed; no duplicate probe sent',
			sub: [
				sub(
					'terminal-accepted',
					status,
					firstError || String(submission.httpStatus ?? submission.error),
				),
			],
			evidence: { attempted: true, submitRequests: attempts },
		}
	}

	const reRead = await connectUnary(
		options.base,
		'GetDaily',
		{ gameSlug: PLAY_SLUG, difficulty, puzzleDate: productDayKeyValue },
		{ guestCookie, timeoutMs: options.timeoutMs },
	)
	const reBody = asRecord(reRead.bodyJson)
	const completedSession = asRecord(reBody?.completedSession)
	const second = await connectUnary(
		options.base,
		'SubmitGuess',
		submitBody((asString(submissionBody?.status) as 'won' | 'lost' | null) ?? terminalPlan.status),
		{ guestCookie, timeoutMs: options.timeoutMs },
	)
	const secondRefused = second.httpStatus === 409 && second.connectMessage === 'already_played'
	const subResults: SubResult[] = [
		sub(
			'terminal-accepted',
			accepted ? 'pass' : 'fail',
			`SubmitGuess(${PLAY_SLUG}, plan=${terminalPlan.status}) → ${submission.httpStatus ?? submission.error}; valid=${String(
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
		summary: `${PLAY_SLUG}: plan=${terminalPlan.kind}/${terminalPlan.status}; SubmitGuess → ${
			submission.httpStatus ?? 'no response'
		} valid=${String(submissionBody?.valid)}; re-read hasCompleted=${String(reBody?.hasCompleted)}; second terminal → ${
			second.httpStatus ?? 'no response'
		}:${second.connectMessage ?? '?'}`,
		sub: subResults,
		evidence: {
			attempted: true,
			guestId: options.guest,
			gameSlug: PLAY_SLUG,
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
			secondTerminal: { ...connectEvidence(second), bodyExcerpt: null },
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
	/** Returns this status for every GetDaily probe (e.g. 525). */
	dailyStatusAll?: number
	salesOpen?: boolean
	coldOverride?: { slug: string; response: StubResponse }
	allowFourth?: boolean
	/** Requires a unique solve unless the fixture deliberately has none. */
	ambiguousSudoku?: boolean
	/**
	 * Pinned clock shared by the stub and the harness. Today's pick is derived
	 * from it with `featuredSlugForDayKey` (default SELF_TEST_NOW, a sudoku day).
	 */
	now?: Date
	/** Override for the board returned by the first StartDaily. */
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

/** 2026-01-04 HKT noon: product-day ordinal0 3, today's pick = sudoku. */
const SELF_TEST_NOW = new Date('2026-01-04T04:00:00.000Z')
/** 2026-01-06 HKT noon: product-day ordinal0 5, today's pick = word-guess. */
const SELF_TEST_WORD_GUESS_DAY = new Date('2026-01-06T04:00:00.000Z')
const STUB_GUEST_COOKIE = '__Host-puzzled_guest=synthetic-stub-credential'

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

/** Stateful loopback stub: writes must use the bootstrapped browser session. */
function makeStubConfigHandler(config: StubConfig): StubHandler {
	const started = new Set<string>()
	let minted = false
	let completed = false
	return ({ method, path, headers, body }) => {
		const host = headers.host ?? '127.0.0.1'
		const origin = `http://${host}`
		const dayKey = productDayKey(config.now ?? SELF_TEST_NOW)
		const freeSlug = featuredSlugForDayKey(dayKey)
		const override = config.routes?.[path]
		if (override) return override
		const browserPost =
			method === 'POST' && headers.origin === origin && headers['sec-fetch-site'] === 'same-origin'
		const guestWrite =
			browserPost &&
			minted &&
			headers.cookie === STUB_GUEST_COOKIE &&
			headers['x-puzzled-verification'] === '1'
		const parsed = asRecord(safeJsonParse(body).value) ?? {}
		const slug = asString(parsed.gameSlug) ?? ''
		const requestedDate = asString(parsed.puzzleDate) ?? dayKey
		const daily = {
			gameSlug: slug,
			puzzleNumber: 1,
			puzzleDate: requestedDate,
			...(slug === 'sudoku' ? { difficulty: 'medium' } : {}),
			canPlay: true,
			mode: requestedDate === dayKey ? 'daily' : 'archive',
		}
		if (path === '/puzzled.v1.BillingService/ListPlans')
			return jsonStub(config.salesOpen ? { salesOpen: true } : {})
		if (path === '/v1/guest/session') {
			if (!browserPost || minted || headers.cookie)
				return jsonStub({ message: 'invalid bootstrap' }, 400)
			minted = true
			const result = jsonStub({}, 201)
			return {
				...result,
				headers: {
					...result.headers,
					'set-cookie': `${STUB_GUEST_COOKIE}; Secure; HttpOnly; Path=/`,
				},
			}
		}
		if (path === `${CONNECT_PREFIX}/GetDaily`) {
			if (config.dailyStatusAll) return jsonStub({ message: 'stub outage' }, config.dailyStatusAll)
			if (requestedDate > dayKey)
				return jsonStub({ code: 'invalid_argument', message: 'future_puzzle_date' }, 400)
			if (requestedDate < dayKey && config.salesOpen)
				return jsonStub({ message: 'plus_required_archive' }, 403)
			if (requestedDate === dayKey && !headers.cookie && config.coldOverride?.slug === slug)
				return config.coldOverride.response
			if (guestWrite && slug === 'sudoku' && completed)
				return jsonStub({
					...daily,
					hasCompleted: true,
					canPlay: false,
					completedSession: { status: config.ambiguousSudoku ? 'lost' : 'won' },
				})
			return jsonStub(
				requestedDate === dayKey
					? { ...daily, requiresStart: true }
					: { ...daily, puzzleDataJson: '{"archive":true}' },
			)
		}
		if (path === `${CONNECT_PREFIX}/StartDaily`) {
			if (
				!guestWrite ||
				parsed.puzzleDate !== dayKey ||
				parsed.difficulty !== (slug === 'sudoku' ? 'medium' : '')
			) {
				return jsonStub({ message: 'invalid start' }, 400)
			}
			if (config.salesOpen && started.size === 3 && !started.has(slug) && !config.allowFourth) {
				return jsonStub({ code: 'permission_denied', message: 'plus_required' }, 403)
			}
			started.add(slug)
			const puzzleDataJson =
				slug === 'sudoku'
					? (config.puzzleDataJson ??
						JSON.stringify({
							grid: config.ambiguousSudoku
								? STUB_SUDOKU_GRID.map((row) => row.map(() => null))
								: STUB_SUDOKU_GRID,
						}))
					: JSON.stringify(slug === 'word-guess' ? { wordLength: 5 } : { size: 5 })
			return jsonStub({ daily: { ...daily, puzzleDataJson, puzzleId: `stub-${slug}` } })
		}
		if (path === `${CONNECT_PREFIX}/SubmitGuess`) {
			if (
				!guestWrite ||
				slug !== 'sudoku' ||
				!started.has(slug) ||
				parsed.puzzleDate !== dayKey ||
				parsed.difficulty !== 'medium' ||
				parsed.puzzleId !== 'stub-sudoku' ||
				parsed.status !== (config.ambiguousSudoku ? 'lost' : 'won') ||
				!asRecord(safeJsonParse(asString(parsed.submissionJson) ?? '').value)?.finalGrid
			)
				return jsonStub({ message: 'invalid submit' }, 400)
			if (completed) return jsonStub({ code: 'already_exists', message: 'already_played' }, 409)
			completed = true
			return jsonStub({
				valid: true,
				status: parsed.status,
				revealJson: 'test-reveal-must-not-appear-in-report',
			})
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
		if (path.startsWith('/games/')) {
			const slug = path.slice('/games/'.length)
			return htmlStub(`<!doctype html><html><body><h1>${slug}</h1></body></html>`)
		}
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
	play?: boolean
	expectWrites?: string[]
	expect: (report: Report) => string[]
}

const SELF_TEST_CASES: SelfTestCase[] = [
	{
		id: 'read-only-control-with-plus-on-sale-goes-green-without-writes',
		config: { salesOpen: true },
		expect: (report) => {
			const problems: string[] = []
			const requests = report.checks.find((check) => check.id === 'free-slug-discovery')?.evidence
				.requests
			if (
				!Array.isArray(requests) ||
				requests.length !== 19 ||
				!requests.some(({ slug }) => slug === 'pip-place')
			) {
				problems.push('expected all nineteen catalog games, including pip-place')
			}
			if (
				report.checks.find((check) => check.id === 'share-solution-signature')?.unknownReason !==
				'not_attempted'
			) {
				problems.push('read-only must not claim a solution signature comparison')
			}
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
		// Reviewer F1 case 2: every daily probe 525 on both attempts.
		id: 'f1-catalog-get-daily-525-both-attempts-is-not-green',
		config: { dailyStatusAll: 525 },
		expect: (report) => {
			const problems: string[] = []
			if (report.ok)
				problems.push('run is green although catalog metadata serving was never observed')
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
				if (attemptList?.length !== 2) {
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
				problems.push('indeterminate count is 0 while catalog metadata serving is unobserved')
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
		id: 'play-can-start-any-three-before-finishing-even-on-a-word-guess-day',
		play: true,
		config: { salesOpen: true, now: SELF_TEST_WORD_GUESS_DAY },
		expectWrites: [
			'bootstrap',
			'start:sudoku',
			'start:word-guess',
			'start:nonogram',
			'start:crowns',
			'submit:sudoku',
			'submit:sudoku',
		],
		expect: (report) => {
			const failures: string[] = []
			if (!report.ok) failures.push('play control should pass')
			if (
				report.checks
					.find((check) => check.id === 'start-daily')
					?.sub.find((entry) => entry.id === 'fourth-pick-refused')?.status !== 'pass'
			)
				failures.push('fourth pick refusal was not verified')
			if (
				JSON.stringify(report).includes(STUB_GUEST_COOKIE) ||
				JSON.stringify(report).includes('test-reveal-must-not-appear-in-report')
			)
				failures.push('report reveals credential or answer')
			return failures
		},
	},
	{
		id: 'sales-closed-archive-served-and-no-fourth-pick-probe',
		play: true,
		config: {},
		expectWrites: [
			'bootstrap',
			'start:sudoku',
			'start:word-guess',
			'start:nonogram',
			'submit:sudoku',
			'submit:sudoku',
		],
		expect: (report) => (report.ok ? [] : ['sales-closed play control should pass']),
	},
	{
		id: 'a-served-fourth-board-while-plus-is-on-sale-fails',
		play: true,
		config: { salesOpen: true, allowFourth: true },
		expectWrites: [
			'bootstrap',
			'start:sudoku',
			'start:word-guess',
			'start:nonogram',
			'start:crowns',
		],
		expect: (report) =>
			!report.ok && report.checks.find((check) => check.id === 'start-daily')?.status === 'fail'
				? []
				: ['unexpected fourth board must fail start-daily'],
	},
	{
		id: 'early-board-on-nonfeatured-game-fails-without-bootstrap',
		play: true,
		config: {
			coldOverride: {
				slug: 'pip-place',
				response: jsonStub({
					gameSlug: 'pip-place',
					puzzleDate: '2026-01-04',
					requiresStart: true,
					canPlay: true,
					puzzleDataJson: '{"board":true}',
				}),
			},
		},
		expect: (report) =>
			!report.ok && report.checks.find((check) => check.id === 'daily-serve')?.status === 'fail'
				? []
				: ['board exposed before StartDaily must fail the cold metadata check'],
	},
	{
		id: 'legacy-paid-slug-refusal-does-not-pass-cold-read',
		config: {
			salesOpen: true,
			coldOverride: { slug: 'nonogram', response: jsonStub({ message: 'plus_required' }, 403) },
		},
		expect: (report) =>
			!report.ok &&
			report.checks.find((check) => check.id === 'free-slug-discovery')?.status === 'fail'
				? []
				: ['gating another game on cold GetDaily must fail'],
	},
	{
		id: 'an-unreadable-sale-state-is-not-closed-and-does-not-start-play',
		play: true,
		config: {
			routes: { '/puzzled.v1.BillingService/ListPlans': jsonStub({ message: 'unavailable' }, 503) },
		},
		expect: (report) =>
			!report.ok &&
			report.checks.find((check) => check.id === 'archive-open')?.unknownReason === 'indeterminate'
				? []
				: ['an unreadable sales state must not pass archive verification'],
	},
	{
		id: 'missing-requires-start-flag-does-not-pass-cold-read',
		config: {
			coldOverride: {
				slug: 'pip-place',
				response: jsonStub({ gameSlug: 'pip-place', puzzleDate: '2026-01-04', canPlay: true }),
			},
		},
		expect: (report) =>
			!report.ok && report.checks.find((check) => check.id === 'daily-serve')?.status === 'fail'
				? []
				: ['cold metadata must explicitly require start'],
	},
	{
		id: 'f2-share-leak-compare-unknown-without-unique-solution',
		play: true,
		config: { ambiguousSudoku: true },
		expectWrites: [
			'bootstrap',
			'start:sudoku',
			'start:word-guess',
			'start:nonogram',
			'submit:sudoku',
			'submit:sudoku',
		],
		expect: (report) =>
			!report.ok &&
			report.checks.find((check) => check.id === 'share-solution-signature')?.unknownReason ===
				'indeterminate'
				? []
				: ['a requested signature comparison without a solution must stay indeterminate'],
	},
	{
		id: 'f3-empty-started-board-fails-without-submitting',
		play: true,
		config: { puzzleDataJson: '{}' },
		expectWrites: ['bootstrap', 'start:sudoku'],
		expect: (report) =>
			!report.ok && report.checks.find((check) => check.id === 'start-daily')?.status === 'fail'
				? []
				: ['empty StartDaily board must fail without submitting'],
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
		const writes: string[] = []
		const handle = makeStubConfigHandler(testCase.config)
		const stub = await startStub((request) => {
			const slug = asRecord(safeJsonParse(request.body).value)?.gameSlug
			if (request.path === '/v1/guest/session') writes.push('bootstrap')
			if (request.path === `${CONNECT_PREFIX}/StartDaily`) writes.push(`start:${String(slug)}`)
			if (request.path === `${CONNECT_PREFIX}/CheckGuess`) writes.push(`grade:${String(slug)}`)
			if (request.path === `${CONNECT_PREFIX}/SubmitGuess`) writes.push(`submit:${String(slug)}`)
			return handle(request)
		})
		try {
			const options: Options = {
				base: stub.base,
				play: testCase.play ?? false,
				guest: crypto.randomUUID(),
				json: true,
				timeoutMs: 5_000,
				expectedSha: null,
				selfTest: false,
				now: testCase.config.now ?? SELF_TEST_NOW,
			}
			const { report } = await runReport(options)
			const exitCode = report.ok ? 0 : 1
			const problems = testCase.expect(report)
			if (JSON.stringify(writes) !== JSON.stringify(testCase.expectWrites ?? [])) {
				problems.push(`unexpected write sequence: ${writes.join(', ')}`)
			}
			if (testCase.id.startsWith('play-can-start') && !report.ok) {
				problems.push(
					...report.checks
						.filter((check) => check.status !== 'pass')
						.map((check) => `${check.id}: ${check.summary}`),
				)
			}
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
 * it explicitly labels itself `not_attempted` (the explicit read-only exemptions). Any
 * other unknown — including a check that went unknown because its evidence was
 * missing — is indeterminate and fails the machine verdict.
 */
async function runReport(options: Options): Promise<{ report: Report }> {
	const observedAt = new Date().toISOString()

	const checks: Check[] = []
	const healthz = await checkHealthz(options.base, options.timeoutMs, options.expectedSha)
	const healthzSha = asString(healthz.evidence.gitCommitSha)
	const readyz = await checkReadyz(options.base, healthzSha, options.timeoutMs)
	const billing = await readSalesOpen(options.base, options.timeoutMs)
	const discovery = await checkFreeSlugDiscovery(options)
	const localDayKey = productDayKey(options.now ?? new Date())
	const serve = checkDailyServe(discovery, localDayKey)
	const web = await checkWebDocument(options, discovery)
	const productDayKeyValue = discovery.productDayKeyFromServer ?? localDayKey
	const productDayKeySource = discovery.productDayKeyFromServer
		? 'server GetDaily puzzleDate'
		: 'local Asia/Hong_Kong (UTC+8)'
	const archive = await checkArchiveOpen(options, discovery, productDayKeyValue, billing)
	const marks = await checkMarksScan(options, discovery, web.result, web.canonicalLocalhost)
	const start = await checkStartDaily(
		options,
		discovery,
		serve,
		productDayKeyValue,
		billing.salesOpen,
	)
	const terminalPlan = start.started ? buildTerminalPlan(PLAY_SLUG, start.started.puzzleData) : null
	const share = await checkShareDeepLink(
		options,
		options.play ? PLAY_SLUG : discovery.featuredSlug,
		productDayKeyValue,
		productDayKeySource,
		terminalPlan,
	)
	const finish = await checkFinishLoop(options, start.started, productDayKeyValue, terminalPlan)

	// Stable report order: the required check list, not execution order.
	checks.push(
		healthz,
		readyz,
		web.check,
		discovery.check,
		serve,
		share.check,
		share.signatureCheck,
		archive,
		marks,
		start.check,
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
		mode: options.play ? 'play (claims picks and writes one guest finish)' : 'read-only',
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
		console.log(`run label     ${report.guestId}`)
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
