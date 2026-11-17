import { locales } from '../i18n/config'

export const RELAY_PATH = '/api/observability/errors'
export const MAX_BODY_BYTES = 32 * 1024
export const MAX_BREADCRUMBS = 15
export const RELAY_TIMEOUT_MS = 2400

// Never echo a path segment, even if it appears to contain a slug or a locale.
const routes = [
	'/',
	'/admin',
	'/admin/analytics',
	'/admin/announcements',
	'/admin/audit-logs',
	'/admin/dlq',
	'/admin/experiments',
	'/admin/games',
	'/admin/games/[slug]',
	'/admin/settings',
	'/admin/system',
	'/archive',
	'/challenge',
	'/daily',
	'/delete-account',
	'/family/join',
	'/forgot-password',
	'/games',
	'/games/[slug]',
	'/leaderboard',
	'/login',
	'/pricing',
	'/privacy',
	'/profile',
	'/r/[shareId]',
	'/reset-password',
	'/settings',
	'/settings/account',
	'/settings/notifications',
	'/settings/preferences',
	'/settings/privacy',
	'/settings/profile',
	'/settings/security',
	'/settings/subscription',
	'/signup',
	'/stats',
	'/support',
	'/terms',
	'/tokushoho',
	'/unsubscribe',
	'/use-cases/daily-word-and-logic-puzzles-online',
	'/use-cases/family-brain-games-no-ads',
	'/verify-email',
	'unknown',
] as const
export type Route = (typeof routes)[number]
const localeSegments = new Set<string>(locales)
const staticRoutes = new Map<string, Route>(routes.map((route) => [route, route]))

export function routeTemplate(pathname: string): Route {
	const parts = pathname.replace(/\/$/, '').split('/').slice(1)
	if (localeSegments.has(parts[0])) parts.shift()
	if (parts.length === 2 && parts[1]) {
		if (parts[0] === 'games') return '/games/[slug]'
		if (parts[0] === 'r') return '/r/[shareId]'
	}
	if (parts.length === 3 && parts[0] === 'admin' && parts[1] === 'games' && parts[2]) {
		return '/admin/games/[slug]'
	}
	return staticRoutes.get(`/${parts.join('/')}`) ?? 'unknown'
}

export const clickSelectors = ['button', 'link', 'role=button', 'role=link', 'summary'] as const
export type ClickSelector = (typeof clickSelectors)[number]
export const mediaSelectors = ['img', 'audio', 'video'] as const
export type MediaSelector = (typeof mediaSelectors)[number]
const boundaries = ['admin', 'auth', 'game-page', 'global', 'locale', 'main-layout'] as const
export type Boundary = (typeof boundaries)[number]
export const cspSelectors = [
	'script-src',
	'script-src-elem',
	'script-src-attr',
	'style-src',
	'style-src-elem',
	'style-src-attr',
	'connect-src',
	'img-src',
	'font-src',
	'media-src',
	'frame-src',
	'worker-src',
	'object-src',
	'form-action',
	'frame-ancestors',
	'default-src',
	'other',
] as const

const selectors = {
	UncaughtError: ['window'],
	UnhandledRejection: ['window'],
	BoundaryError: boundaries,
	MediaError: mediaSelectors,
	EmptyMediaSource: mediaSelectors,
	IneffectiveClick: clickSelectors,
	CSPViolation: cspSelectors,
} as const
export type IssueType = keyof typeof selectors
export const messages: Record<IssueType, string> = {
	UncaughtError: 'Uncaught browser exception',
	UnhandledRejection: 'Unhandled promise rejection',
	BoundaryError: 'Application error boundary',
	MediaError: 'Media failed to load',
	EmptyMediaSource: 'Media has an empty source',
	IneffectiveClick: 'Repeated click without an observed effect',
	CSPViolation: 'Content Security Policy violation',
}
export type Issue = {
	[K in IssueType]: { type: K; selector: (typeof selectors)[K][number] }
}[IssueType]
export type Crumb = { route: Route } & (
	| { kind: 'navigation' }
	| { kind: 'click'; selector: ClickSelector }
	| { kind: 'http'; status: number }
)
export type BrowserReport = Issue & { route: Route; breadcrumbs: Crumb[] }

export function contains<T extends string>(values: readonly T[], value: unknown): value is T {
	return values.some((item) => item === value)
}

function record(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function exact(value: Record<string, unknown>, keys: string[]): boolean {
	return Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key))
}

function validCrumb(value: unknown): boolean {
	if (!record(value) || !contains(routes, value.route)) return false
	switch (value.kind) {
		case 'navigation':
			return exact(value, ['kind', 'route'])
		case 'click':
			return exact(value, ['kind', 'route', 'selector']) && contains(clickSelectors, value.selector)
		case 'http':
			return (
				exact(value, ['kind', 'route', 'status']) &&
				typeof value.status === 'number' &&
				Number.isInteger(value.status) &&
				value.status >= 100 &&
				value.status <= 599
			)
		default:
			return false
	}
}

export function isBrowserReport(value: unknown): value is BrowserReport {
	if (!record(value) || !exact(value, ['type', 'selector', 'route', 'breadcrumbs'])) return false
	const { type, selector, route, breadcrumbs } = value
	return (
		typeof type === 'string' &&
		Object.hasOwn(selectors, type) &&
		selectors[type as IssueType].some((allowed) => allowed === selector) &&
		contains(routes, route) &&
		Array.isArray(breadcrumbs) &&
		breadcrumbs.length <= MAX_BREADCRUMBS &&
		breadcrumbs.every(validCrumb)
	)
}
