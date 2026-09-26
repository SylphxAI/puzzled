/**
 * Error capture into Sylphx Observability (OBS-ERRORS), server side, through
 * the Sylphx SDK: `sylphx.observability.errorGroups.capture` on
 * api.sylphx.com with the environment's Access key (`SYLPHX_API_KEY`,
 * minted and injected by the platform). The key never reaches the browser:
 * browser errors come through this app's own relay route.
 *
 * The service parses the raw stack, maps minified browser frames through the
 * release's uploaded source maps, groups by exception type and in-app frames
 * (never by release), and scrubs secrets, tokens, card numbers and email
 * addresses before storing. This module never attaches a request body, so
 * auth and billing payloads cannot reach an error report.
 *
 * Observability is a soft dependency: capture never throws, gives up after a
 * short timeout, and without a key only writes to the console.
 */

import type { observability } from '@sylphx/sdk'
import { Sylphx } from '@sylphx/sdk'

/** The key's own org, project and environment. */
export const PARENT = 'orgs/-/projects/-/envs/-'
const TIMEOUT_MS = 3000

export type Breadcrumb = {
	/** Short category such as `navigation`, `http`, or `ui`. */
	category?: string
	message: string
	/** ISO time; defaults to now. */
	timestamp?: string
}

export type CaptureContext = {
	/** Emitting service; defaults to SYLPHX_SERVICE_NAME. */
	service?: string
	/** Route template or page path that failed, without its query string. */
	route?: string
	tags?: Record<string, string | number | boolean | undefined>
	breadcrumbs?: Breadcrumb[]
	/** W3C trace id (32 hex) and span id (16 hex), when known. */
	traceId?: string
	spanId?: string
	/** A raw stack captured elsewhere (for example in the browser). */
	stack?: string
	/** Exception type captured elsewhere. */
	exceptionType?: string
	/** Override the grouping fingerprint. */
	fingerprint?: string
}

type Env = Record<string, string | undefined>

/** The SDK error event, plus the raw `stack` text the service parses into frames. */
export type CaptureEvent = observability.ErrorEvent & { stack?: string }

let client: Sylphx | undefined

function sdk(env: Env): Sylphx {
	client ??= new Sylphx({ apiKey: env.SYLPHX_API_KEY, timeoutMs: TIMEOUT_MS, maxRetries: 1 })
	return client
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

function withoutQuery(route: string): string {
	return route.replace(/[?#].*$/, '')
}

/** The error event for one occurrence; exported for tests. */
export function buildErrorEvent(
	error: unknown,
	context: CaptureContext = {},
	env: Env = process.env,
): CaptureEvent {
	const described = describe(error)
	const tags: Record<string, string> = {}
	for (const [key, value] of Object.entries(context.tags ?? {})) {
		if (value !== undefined) tags[key] = String(value)
	}
	if (env.SYLPHX_ENVIRONMENT_TYPE) tags.environment = env.SYLPHX_ENVIRONMENT_TYPE
	if (context.route) tags.route = withoutQuery(context.route)
	const stack = context.stack ?? described.stack
	return {
		eventTime: new Date().toISOString(),
		exceptionType: context.exceptionType || described.type,
		message: described.message.slice(0, 2000),
		serviceName: context.service || env.SYLPHX_SERVICE_NAME || 'web',
		release: env.SYLPHX_GIT_COMMIT_SHA || undefined,
		stack: stack ? stack.slice(0, 16_000) : undefined,
		breadcrumbs: (context.breadcrumbs ?? []).slice(-50).map((crumb) => ({
			eventTime: crumb.timestamp ?? new Date().toISOString(),
			category: crumb.category,
			message: crumb.message.slice(0, 500),
		})),
		tags,
		fingerprint: context.fingerprint,
		traceId: context.traceId,
		spanId: context.spanId,
	}
}

/**
 * Records one error occurrence. Never throws; resolves to the occurrence
 * name, or undefined when capture is off or failed.
 */
export async function captureException(
	error: unknown,
	context: CaptureContext = {},
	options: { env?: Env; client?: Pick<Sylphx, 'observability'> } = {},
): Promise<string | undefined> {
	const env = options.env ?? process.env
	if (!options.client && !env.SYLPHX_API_KEY?.trim()) {
		console.error('[observability] capture off (no SYLPHX_API_KEY):', error)
		return undefined
	}
	try {
		const response = await (options.client ?? sdk(env)).observability.errorGroups.capture({
			parent: PARENT,
			errorEvent: buildErrorEvent(error, context, env),
		})
		return response.errorEvent?.name
	} catch (captureError) {
		console.error('[observability] capture failed:', captureError, error)
		return undefined
	}
}
