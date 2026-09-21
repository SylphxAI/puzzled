/**
 * The app's single logging seam (TD-20).
 *
 * - Level: `log('warn', ...)` / `logger.warn(...)`, gated by `LOG_LEVEL` (default: debug = everything).
 * - Redaction: top-level fields whose key looks sensitive are replaced with `[redacted]`.
 * - Correlation: pass `correlationId` in `fields`; `correlationIdFrom(headers)` covers the
 *   trivial route-header case. No request-scoped machinery lives here.
 * - Isomorphic: console under the hood - works in server components, route handlers and the browser.
 * - Never throws: logging must not be able to break a request or a render.
 *
 * Non-goals: no external sink/shipping, no nested (recursive) redaction - top level only.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

/** Structured fields attached to one log record. `correlationId` is optional. */
export type LogFields = Record<string, unknown> & { correlationId?: string }

const LEVEL_RANK: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 }

/**
 * Field keys that must never be printed verbatim - substring match, case-insensitive, so
 * `userEmail`, `authToken` etc. are covered. Kept deliberately small.
 */
const SENSITIVE_KEY_FRAGMENTS = ['email', 'token', 'secret', 'authorization', 'cookie', 'password']

const REDACTED = '[redacted]'

/** Console method per level: `info` prints via `log`, matching the call sites it replaces. */
const CONSOLE_METHOD: Record<LogLevel, 'debug' | 'log' | 'warn' | 'error'> = {
	debug: 'debug',
	info: 'log',
	warn: 'warn',
	error: 'error',
}

function readEnvLevel(): number {
	try {
		const raw = typeof process !== 'undefined' ? process.env?.LOG_LEVEL : undefined
		if (typeof raw === 'string' && Object.hasOwn(LEVEL_RANK, raw)) {
			return LEVEL_RANK[raw as LogLevel]
		}
	} catch {
		// fall through to the default
	}
	return LEVEL_RANK.debug
}

let minRank: number | null = null

function threshold(): number {
	if (minRank === null) minRank = readEnvLevel()
	return minRank
}

/** Test/ops hook: set the minimum level; `null` falls back to `LOG_LEVEL`/default. */
export function setLogLevel(level: LogLevel | null): void {
	minRank = level === null ? null : (LEVEL_RANK[level] ?? LEVEL_RANK.debug)
}

function isSensitiveKey(key: string): boolean {
	const normalized = key.toLowerCase()
	return SENSITIVE_KEY_FRAGMENTS.some((fragment) => normalized.includes(fragment))
}

function redactFields(fields: Record<string, unknown>): Record<string, unknown> {
	const redacted: Record<string, unknown> = {}
	for (const key of Object.keys(fields)) {
		redacted[key] = isSensitiveKey(key) ? REDACTED : fields[key]
	}
	return redacted
}

/**
 * Emit one structured record. `event` names the countable thing that happened
 * (e.g. `unsubscribe.token-rejected`); `fields` carries its structured detail.
 */
export function log(level: LogLevel, event: string, fields?: LogFields | null): void {
	try {
		const resolved = (Object.hasOwn(LEVEL_RANK, level) ? level : 'info') as LogLevel
		if (LEVEL_RANK[resolved] < threshold()) return
		if (typeof console === 'undefined') return

		let payload: Record<string, unknown> | undefined
		if (fields !== null && fields !== undefined) {
			if (typeof fields !== 'object') {
				payload = { fields }
			} else {
				try {
					payload = redactFields(fields)
				} catch {
					payload = undefined
				}
			}
		}

		const line = `[${resolved}] ${typeof event === 'string' ? event : String(event)}`
		const consoleLike = console as unknown as Record<
			string,
			((...args: unknown[]) => void) | undefined
		>
		const sink = consoleLike[CONSOLE_METHOD[resolved]] ?? consoleLike.log
		if (!sink) return
		if (payload !== undefined) sink.call(console, line, payload)
		else sink.call(console, line)
	} catch {
		// Logging must never throw.
	}
}

/** Convenience wrappers: `logger.info('event', { ... })`. */
export const logger = {
	debug: (event: string, fields?: LogFields | null): void => log('debug', event, fields),
	info: (event: string, fields?: LogFields | null): void => log('info', event, fields),
	warn: (event: string, fields?: LogFields | null): void => log('warn', event, fields),
	error: (event: string, fields?: LogFields | null): void => log('error', event, fields),
}

/** The minimal shape a request's headers have (structurally compatible with `Headers`). */
export interface CorrelationSource {
	get(name: string): string | null
}

/**
 * Correlation id from a request's headers where one is trivially in scope
 * (`x-request-id`, falling back to `x-correlation-id`). Returns `undefined` when absent.
 */
export function correlationIdFrom(
	headers: CorrelationSource | null | undefined,
): string | undefined {
	try {
		const fromRequest = headers?.get?.('x-request-id')
		if (fromRequest) return fromRequest
		return headers?.get?.('x-correlation-id') ?? undefined
	} catch {
		return undefined
	}
}
