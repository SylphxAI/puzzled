/**
 * Browser error capture: uncaught errors, unhandled rejections, and errors
 * reported by error boundaries are posted to this app's own relay route,
 * which captures them into Sylphx Observability with the server's key. The
 * browser holds no key and loads no third-party script.
 *
 * Reports carry the error, its stack, the page path (never the query string),
 * and the last navigation breadcrumbs. At most 10 reports leave one page load.
 *
 * Content Security Policy violations are reported the same way, one per
 * directive and blocked origin, so a policy regression shows up as an error
 * group (`CSPViolation`, tag handler=csp).
 */

export const RELAY_PATH = '/api/observability/errors'
const MAX_REPORTS = 10
const MAX_CRUMBS = 20

type Crumb = { category: string; message: string; timestamp: string }

const state: { installed: boolean; sent: number; seen: Set<string>; crumbs: Crumb[] } = {
	installed: false,
	sent: 0,
	seen: new Set(),
	crumbs: [],
}

function path(): string {
	return typeof location === 'undefined' ? '' : location.pathname
}

/** Adds a breadcrumb that the next report carries. */
export function addBreadcrumb(category: string, message: string): void {
	state.crumbs.push({
		category,
		message: message.slice(0, 300),
		timestamp: new Date().toISOString(),
	})
	if (state.crumbs.length > MAX_CRUMBS) state.crumbs.shift()
}

/** Sends one error to the relay; safe to call anywhere, never throws. */
export function reportError(error: unknown, tags: Record<string, string | undefined> = {}): void {
	if (typeof window === 'undefined') return
	try {
		const err =
			error instanceof Error ? error : new Error(typeof error === 'string' ? error : String(error))
		const key = `${err.name}:${err.message}`
		if (state.sent >= MAX_REPORTS || state.seen.has(key)) return
		state.seen.add(key)
		state.sent += 1
		const cleanTags: Record<string, string> = {}
		for (const [name, value] of Object.entries(tags)) if (value) cleanTags[name] = value
		const body = JSON.stringify({
			type: err.name,
			message: err.message || err.name,
			stack: err.stack?.slice(0, 16_000),
			path: path(),
			breadcrumbs: state.crumbs,
			tags: cleanTags,
		})
		void fetch(RELAY_PATH, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			credentials: 'same-origin',
			keepalive: true,
			body,
		}).catch(() => undefined)
	} catch {
		// Reporting must never break the page.
	}
}

/** Installs the global handlers once; returns an uninstall function. */
export function installBrowserErrorCapture(): () => void {
	if (typeof window === 'undefined' || state.installed) return () => undefined
	state.installed = true
	const onError = (event: ErrorEvent) =>
		reportError(event.error ?? event.message, { handler: 'onerror' })
	const onRejection = (event: PromiseRejectionEvent) =>
		reportError(event.reason, { handler: 'unhandledrejection' })
	const onNavigate = () => addBreadcrumb('navigation', path())
	const onViolation = (event: SecurityPolicyViolationEvent) => {
		const violation = new Error(cspViolationMessage(event))
		violation.name = 'CSPViolation'
		reportError(violation, { handler: 'csp', disposition: event.disposition })
	}
	window.addEventListener('error', onError)
	window.addEventListener('unhandledrejection', onRejection)
	document.addEventListener('securitypolicyviolation', onViolation)
	window.addEventListener('popstate', onNavigate)
	addBreadcrumb('navigation', path())
	return () => {
		window.removeEventListener('error', onError)
		window.removeEventListener('unhandledrejection', onRejection)
		document.removeEventListener('securitypolicyviolation', onViolation)
		window.removeEventListener('popstate', onNavigate)
		state.installed = false
	}
}

/**
 * One stable message per directive and blocked source: the blocked URL keeps
 * only its origin (no path or query), and inline or eval blocks keep their
 * keyword, so the same fault always lands in the same error group.
 */
export function cspViolationMessage(event: {
	effectiveDirective: string
	blockedURI: string
}): string {
	let blocked = event.blockedURI || 'unknown'
	try {
		blocked = new URL(blocked).origin
	} catch {
		// 'inline', 'eval', 'wasm-eval' and similar keywords are not URLs.
	}
	return `CSP ${event.effectiveDirective} blocked ${blocked}`
}
