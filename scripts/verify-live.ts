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

// ---------------------------------------------------------------------------
// Constants (contracts this harness asserts against)
// ---------------------------------------------------------------------------

const DEFAULT_BASE = 'https://puzzled.gg'
const DEFAULT_TIMEOUT_MS = 20_000
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

/**
 * Spoiler tokens from `shareTextLooksNonSpoiler`
 * (apps/puzzled/src/features/daily/lib/share-text.ts).
 */
const SHARE_SPOILER_TOKENS = [
	'solution',
	'answer is',
	'the word was',
	'grid:',
	'"grid"',
	'solved cells',
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
	solvedGrid: number[][] | null
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
  --json            print the stable JSON report on stdout (human lines on stderr)
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
		const bodyText = await response.text()
		const contentType = response.headers.get('content-type')
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
			location: null,
			middlewareRewrite: null,
			error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
		}
	}
}

function httpEvidence(result: HttpResult): Record<string, unknown> {
	return {
		url: result.url,
		method: result.method,
		httpStatus: result.httpStatus,
		timeMs: result.timeMs,
		contentType: result.contentType,
		bodyBytes: result.bodyBytes,
		bodySha256: result.bodySha256,
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
	if (emptyCount === 0) {
		return {
			kind: 'win',
			status: 'won',
			data: { finalGrid: cells, mistakes: 0 },
			solver: { kind: 'none', reason: 'served grid is already complete' },
			solvedGrid: cells,
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
			solvedGrid: solutions[0],
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
		solvedGrid: null,
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
		return {
			kind: 'win',
			status: 'won',
			data: { finalGrid: toGrid(solutions[0]) },
			solver: { kind: 'crowns-backtracking', solutionCountUpTo2: 1, size },
			solvedGrid: null,
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
		solvedGrid: null,
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
				solvedGrid: null,
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
				solvedGrid: null,
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
				solvedGrid: null,
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
	const subResults: SubResult[] = [
		sub(
			'http-200',
			result.httpStatus === 200 ? 'pass' : result.httpStatus === null ? 'unknown' : 'fail',
			`GET /healthz → ${result.httpStatus ?? result.error} in ${result.timeMs}ms`,
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
	const requiredUnhealthy = dependencyStates.filter(
		(entry) => entry.required === true && entry.ok !== true,
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
	const freeEntry = free[0] ?? null
	const freeResultEntry = results.find((entry) => entry.slug === freeEntry?.slug) ?? null
	const freeBody = freeResultEntry ? asRecord(freeResultEntry.result.bodyJson) : null
	const puzzleDate = asString(freeBody?.puzzleDate)
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
				expectedLocalProductDayKey: productDayKey(),
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
			puzzleDataJson && !puzzleParse.error ? 'pass' : 'fail',
			puzzleDataJson
				? `puzzleDataJson ${puzzleDataJson.length}B parseError=${puzzleParse.error ?? 'none'} keys=${Object.keys(asRecord(puzzleParse.value) ?? {}).join(',')}`
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
): Promise<{ check: Check; html: string; canonical: string | null; canonicalLocalhost: boolean }> {
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
	const freeGameHrefs = discovery.freeSlug
		? hrefs.filter((href) => {
				const path = href.split(/[?#]/)[0].replace(/\/+$/, '')
				return (
					path === `/games/${discovery.freeSlug}` || path.endsWith(`/games/${discovery.freeSlug}`)
				)
			})
		: []
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
				renderedTextExcerpt: excerpt(textBody, 300),
			},
		},
		html,
		canonical,
		canonicalLocalhost,
	}
}

type ShareResult = {
	check: Check
	solvedGrid: number[][] | null
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
			solvedGrid: null,
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
	const finalOk =
		final.httpStatus === 200 && Boolean(final.contentType?.toLowerCase().includes('text/html'))
	const sharePathFormatOk =
		/^\/games\/[a-z0-9-]+\?date=\d{4}-\d{2}-\d{2}$/.test(path) && isDayKey(productDayKeyValue)
	const expectedShareText = `🏆 ${discovery.freeSlug} • ${productDayKeyValue}\n✅ Completed\n\n${hostOf(options.base)}${path}`
	const shareSpoilerHits = SHARE_SPOILER_TOKENS.filter((token) =>
		expectedShareText.toLowerCase().includes(token),
	)
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
	const solvedGridFlattened = terminalPlan?.solvedGrid
		? terminalPlan.solvedGrid.map((row) => row.join('')).join('')
		: null
	const solvedGridSha256 = solvedGridFlattened ? await sha256Hex(solvedGridFlattened) : null
	const solvedGridLeaked = Boolean(solvedGridFlattened && finalHtml.includes(solvedGridFlattened))
	const subResults: SubResult[] = [
		sub(
			'deep-link-html',
			first.httpStatus === null ? 'unknown' : finalOk ? 'pass' : 'fail',
			`GET ${path} → ${first.httpStatus ?? first.error}${
				first.location ? ` → ${first.location} → ${final.httpStatus}` : ''
			}; content-type=${final.contentType ?? 'none'}; ${final.bodyBytes}B in ${final.timeMs}ms`,
		),
		sub(
			'share-path-matches-formatRitualShareText',
			sharePathFormatOk && shareSpoilerHits.length === 0 ? 'pass' : 'fail',
			`path=${path} (module + ?date=); spoiler tokens in expected share text=${JSON.stringify(shareSpoilerHits)}`,
		),
		sub(
			'landing-does-not-leak-solution',
			finalHtml
				? solvedGridLeaked || leakPatternFindings.length > 0
					? 'fail'
					: 'pass'
				: 'unknown',
			finalHtml
				? `solution-key patterns=${leakPatternFindings.length}; harness-solved 81-digit grid present=${solvedGridLeaked}${
						solvedGridFlattened ? '' : ' (no locally solved grid to compare)'
					}`
				: 'no landing HTML observed',
		),
	]
	return {
		check: {
			id: 'share-deep-link',
			title: 'share / deep link (non-spoiler)',
			status: combine(subResults),
			required: true,
			unknownReason: null,
			summary: `GET ${path} → ${first.httpStatus ?? 'no response'}${
				first.location ? ` → ${final.httpStatus}` : ''
			}; product day key ${productDayKeyValue} (${productDayKeySource}); solution leak=${
				solvedGridLeaked || leakPatternFindings.length > 0 ? 'YES' : 'no'
			}`,
			sub: subResults,
			evidence: {
				requestedPath: path,
				requestedUrl: url,
				productDayKey: productDayKeyValue,
				productDayKeySource,
				redirectChain,
				finalUrl: final.url,
				...httpEvidence(final),
				leakPatternFindings,
				solvedGridSha256,
				solvedGridLength: solvedGridFlattened?.length ?? null,
				solvedGridNote:
					'solved grid redacted (sha256 identifies it) so the harness does not publish a solution',
				solvedGridLeaked,
				expectedShareText,
				shareSpoilerHits,
			},
		},
		solvedGrid: terminalPlan?.solvedGrid ?? null,
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
			archive.httpStatus === null ? 'unknown' : archiveFailClosed ? 'pass' : 'fail',
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
	homeHtml: string | null,
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
		error: string | null
	}> = []
	const home = await httpRequest(`${options.base}/`, {
		headers: { accept: 'text/html,application/xhtml+xml' },
		timeoutMs: options.timeoutMs,
	})
	targets.push({
		url: `${options.base}/`,
		label: 'home',
		html: home.bodyText || null,
		httpStatus: home.httpStatus,
		contentType: home.contentType,
		bodyBytes: home.bodyBytes,
		bodySha256: home.bodySha256,
		error: home.error,
	})
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
			hardFailures: findings.hardFailures,
			warnings: findings.warnings,
			warningCount: findings.warningCount,
			canonical,
			canonicalLocalhost: canonicalIsLocalhost,
			jsonLdLocalhostHits: localhostHits,
		})
	}
	// The manifest is part of the player-facing identity surface (short_name).
	const manifestHref =
		homeHtml?.match(/<link[^>]*rel=["']manifest["'][^>]*href=["']([^"']+)["']/i)?.[1] ?? null
	let manifestEvidence: Record<string, unknown> = { url: null, httpStatus: null }
	if (manifestHref) {
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
	const subResults: SubResult[] = [
		sub(
			'target-identity',
			productIdentityOk ? 'pass' : 'unknown',
			productIdentityOk
				? 'served home HTML identifies as the Puzzled web app (title/manifest reference)'
				: 'served home HTML does not identify as the Puzzled web app; the mark scan is vacuous here',
		),
		sub(
			'no-forbidden-marks-in-title-meta-jsonld-manifest',
			targets.every((target) => target.html)
				? hardFailureCount === 0
					? 'pass'
					: 'fail'
				: 'unknown',
			hardFailureCount === 0
				? `no CATALOG §3.2 mark in title/meta/JSON-LD/manifest across ${targets.length} target(s)`
				: `${hardFailureCount} hard failure(s): ${JSON.stringify(
						targetFindings.flatMap((entry) =>
							Array.isArray(entry.hardFailures) ? entry.hardFailures : [],
						),
					)}`,
		),
		sub(
			'no-localhost-origin-in-jsonld-or-canonical',
			targetIsLocal ? 'pass' : localhostFails.length === 0 && !canonicalLocalhost ? 'pass' : 'fail',
			targetIsLocal
				? `target host ${targetHost} is local; localhost origins accepted`
				: `json-ld localhost hits=${localhostFails.length}; canonical localhost=${canonicalLocalhost || homeCanonicalLocalhost}`,
		),
	]
	return {
		id: 'marks-scan',
		title: 'CATALOG §3.2 mark scan + localhost origins',
		status: combine(subResults),
		required: true,
		unknownReason: combine(subResults) === 'unknown' ? 'indeterminate' : null,
		summary: `targets=${targets.length}; hard failures=${hardFailureCount}; warnings=${warningCount}; json-ld localhost=${localhostFails.length}; canonical localhost=${canonicalLocalhost || homeCanonicalLocalhost}`,
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
	const options = parsed
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
	const marks = await checkMarksScan(options, discovery, web.html || null, web.canonicalLocalhost)
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

	const failures = checks.filter((entry) => entry.status === 'fail')
	const indeterminate = checks.filter(
		(entry) => entry.status === 'unknown' && entry.unknownReason === 'indeterminate',
	)
	const notAttempted = checks.filter(
		(entry) => entry.status === 'unknown' && entry.unknownReason === 'not_attempted',
	)
	const ok = failures.length === 0 && indeterminate.length === 0
	const summary = {
		pass: checks.filter((entry) => entry.status === 'pass').length,
		fail: failures.length,
		unknown: checks.filter((entry) => entry.status === 'unknown').length,
		notAttempted: notAttempted.length,
		indeterminate: indeterminate.length,
	}
	const report = {
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
		checks,
	}

	if (options.json) {
		console.log(JSON.stringify(report, null, 2))
	} else {
		console.log(`puzzled live verification — ${options.base}`)
		console.log(`observedAt    ${observedAt}`)
		console.log(`liveRevision  ${healthzSha ?? 'unknown'} (healthz git_commit_sha)`)
		if (options.expectedSha) {
			console.log(
				`expectedSha   ${options.expectedSha} (${healthzSha && shaMatches(healthzSha, options.expectedSha) ? 'matched' : 'MISMATCH'})`,
			)
		}
		console.log(`productDayKey ${productDayKeyValue} (${productDayKeySource})`)
		console.log(
			`guestId       ${options.guest}${options.guestProvided ? ' (provided)' : ' (fresh random)'}`,
		)
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
			`summary: ${summary.pass} pass, ${summary.fail} fail, ${summary.unknown} unknown (${summary.notAttempted} not attempted, ${summary.indeterminate} indeterminate) → exit ${ok ? 0 : 1}`,
		)
		console.log(
			'evidence layer: Live (observed behavior of the target-reported revision); no Deployed/Released identity is claimed.',
		)
	}
	return ok ? 0 : 1
}

if (import.meta.main) {
	const exitCode = await main()
	process.exit(exitCode)
}
