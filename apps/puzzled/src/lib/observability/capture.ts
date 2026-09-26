/**
 * Error capture into Sylphx Observability (OBS-ERRORS), server side.
 *
 * One occurrence per call, posted to the Observability error API with the
 * environment's Access key (`SYLPHX_API_KEY`, minted and injected by the
 * platform). The key never reaches the browser: browser errors come through
 * this app's own relay route, which calls `captureException` here.
 *
 * Observability is a soft dependency. Capture never throws, gives up after a
 * short timeout, and without a key only writes to the console.
 *
 * Privacy: messages, stacks, breadcrumbs, and tags are scrubbed of email
 * addresses, secrets, and URL query strings before they leave the process,
 * and no request body is ever attached.
 *
 * The generated SDK method (`sylphx.observability.errorGroups.capture` on
 * api.sylphx.com) is not served yet; this module moves to it when it is
 * (SylphxAI/cloud platform-request, see docs/observability.md).
 */

const DEFAULT_ORIGIN = 'https://api.observability.sylphx.com'
const CAPTURE_PATH = '/v1/error-events:captureException'
const TIMEOUT_MS = 3000
const MAX_MESSAGE = 1000
const MAX_STACK = 8000
const MAX_BREADCRUMBS = 30
const MAX_TAGS = 32

export type Breadcrumb = {
	/** Short category such as `navigation`, `http`, or `ui`. */
	category?: string
	message: string
	level?: 'debug' | 'info' | 'warn' | 'error'
	/** ISO time; defaults to now. */
	timestamp?: string
}

export type CaptureContext = {
	/** Emitting service; defaults to SYLPHX_SERVICE_NAME. */
	service?: string
	/** Route or handler that failed, without its query string. */
	route?: string
	tags?: Record<string, string | number | boolean | undefined>
	breadcrumbs?: Breadcrumb[]
	/** W3C trace id (32 hex) and span id (16 hex), when known. */
	traceId?: string
	spanId?: string
	/** A stack captured elsewhere (for example in the browser). */
	stack?: string
	/** Exception type captured elsewhere. */
	exceptionType?: string
	/** Override the grouping fingerprint's stack signature. */
	fingerprint?: string
}

type Env = Record<string, string | undefined>
type Fetch = typeof fetch

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
const SECRET =
	/\b(?:sylphx_(?:sk|pk)_[A-Za-z0-9_]+|(?:sk|pk|rk)_(?:live|test|prod|dev)_[A-Za-z0-9]+|eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+|(?:Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,})/g
const QUERY = /(https?:\/\/[^\s?#"'<>]+|\/[^\s?#"'<>]*)\?[^\s#"'<>)]*/g

/** Removes email addresses, credentials, and URL query strings. */
export function scrub(text: string): string {
	return text.replace(EMAIL, '[email]').replace(SECRET, '[secret]').replace(QUERY, '$1')
}

function clip(text: string, max: number): string {
	return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

/** Stack frames without line and column numbers or build hashes, innermost first. */
export function stackSignature(stack: string | undefined, frames = 5): string | undefined {
	if (!stack) return undefined
	const lines = stack
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => line.startsWith('at ') || /@\S/.test(line))
		.slice(0, frames)
		.map((line) =>
			line
				.replace(/:\d+(:\d+)?\)?$/, '')
				.replace(/[?#][^\s)]*/g, '')
				.replace(/\b[0-9a-f]{8,}\b/gi, '#')
				.replace(/[-.][0-9A-Za-z_]{8,20}(?=\.(?:m?js|css)\b)/g, ''),
		)
	return lines.length > 0 ? lines.join('\n') : undefined
}

function normalizedMessage(message: string): string {
	return message.replace(/\b[0-9a-f]{8,}\b/gi, '#').replace(/\d+/g, '0')
}

async function sha256(text: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function describe(error: unknown): { type: string; message: string; stack?: string } {
	if (error instanceof Error) {
		return { type: error.name || 'Error', message: error.message || error.name, stack: error.stack }
	}
	if (typeof error === 'string') return { type: 'Error', message: error }
	try {
		return { type: 'Error', message: JSON.stringify(error) ?? String(error) }
	} catch {
		return { type: 'Error', message: String(error) }
	}
}

function attribute(key: string, value: string) {
	return { key: clip(key, 128), value: { stringValue: clip(scrub(value), 1000) } }
}

/** The request body for one occurrence; exported for tests. */
export async function buildCaptureRequest(
	error: unknown,
	context: CaptureContext = {},
	env: Env = process.env,
) {
	const described = describe(error)
	const type = clip(context.exceptionType || described.type, 200)
	const message = clip(scrub(described.message || type), MAX_MESSAGE)
	const stack = context.stack ?? described.stack
	const cleanStack = stack ? clip(scrub(stack), MAX_STACK) : undefined
	const signature = context.fingerprint ?? stackSignature(cleanStack) ?? normalizedMessage(message)
	// The culprit is part of the group key, so it is the top frame, never a concrete path.
	const culprit = clip(stackSignature(cleanStack, 1) ?? '', 500)
	const tags = Object.entries(context.tags ?? {})
		.filter((entry): entry is [string, string | number | boolean] => entry[1] !== undefined)
		.slice(0, MAX_TAGS)
		.map(([key, value]) => attribute(key, String(value)))
	const environment = env.SYLPHX_ENVIRONMENT_TYPE
	if (environment) tags.push(attribute('environment', environment))
	return {
		idempotencyKey: crypto.randomUUID(),
		event: {
			occurrenceTime: new Date().toISOString(),
			service: clip(context.service || env.SYLPHX_SERVICE_NAME || 'web', 128),
			release: env.SYLPHX_GIT_COMMIT_SHA || undefined,
			fingerprint: {
				exceptionType: type,
				stackSignature: await sha256(`${type}\n${signature}`),
				culprit,
			},
			message,
			traceId: context.traceId,
			spanId: context.spanId,
			route: context.route ? clip(scrub(context.route), 500) : undefined,
			breadcrumbs: (context.breadcrumbs ?? []).slice(-MAX_BREADCRUMBS).map((crumb) => ({
				timestamp: crumb.timestamp ?? new Date().toISOString(),
				category: crumb.category ? clip(crumb.category, 64) : undefined,
				message: clip(scrub(crumb.message), 500),
				level: crumb.level,
			})),
			tags,
			extra: cleanStack ? [{ key: 'stack', value: { stringValue: cleanStack } }] : [],
		},
	}
}

/**
 * Records one error occurrence. Never throws; resolves to the occurrence id,
 * or undefined when capture is off or failed.
 */
export async function captureException(
	error: unknown,
	context: CaptureContext = {},
	options: { env?: Env; fetch?: Fetch } = {},
): Promise<string | undefined> {
	const env = options.env ?? process.env
	const key = env.SYLPHX_API_KEY?.trim()
	if (!key) {
		console.error('[observability] capture off (no SYLPHX_API_KEY):', error)
		return undefined
	}
	try {
		const body = await buildCaptureRequest(error, context, env)
		const origin = (env.SYLPHX_OBSERVABILITY_URL?.trim() || DEFAULT_ORIGIN).replace(/\/+$/, '')
		const response = await (options.fetch ?? fetch)(`${origin}${CAPTURE_PATH}`, {
			method: 'POST',
			headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(TIMEOUT_MS),
		})
		if (!response.ok) {
			console.error(`[observability] capture refused: ${response.status}`, error)
			return undefined
		}
		const result = (await response.json().catch(() => ({}))) as {
			event?: { identity?: { id?: string } }
		}
		return result.event?.identity?.id
	} catch (captureError) {
		console.error('[observability] capture failed:', captureError, error)
		return undefined
	}
}
