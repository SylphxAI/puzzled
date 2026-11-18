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

const clickSelectors = ['button', 'link', 'role=button', 'role=link', 'summary'] as const
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

export function contains<T extends string>(values: readonly T[], value: unknown): value is T {
	return values.some((item) => item === value)
}

/** Encode only collector-owned fields in the existing relay wire format. */
export function encodeBrowserReport(issue: Issue, route: Route, crumbs: readonly Crumb[]) {
	const { type, selector } = issue
	if (!Object.hasOwn(selectors, type) || !contains(selectors[type] as readonly string[], selector))
		return undefined
	return {
		type,
		message: messages[type],
		path: route,
		tags: { selector },
		breadcrumbs: crumbs.map((crumb) => ({
			category: crumb.kind,
			message:
				crumb.kind === 'http'
					? `${crumb.route} ${crumb.status}`
					: crumb.kind === 'click'
						? `${crumb.route} ${crumb.selector}`
						: crumb.route,
		})),
	}
}
