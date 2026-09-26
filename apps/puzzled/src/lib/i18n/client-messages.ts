/**
 * Which message namespaces reach the browser.
 *
 * `NextIntlClientProvider` serialises every message it is handed into the
 * page. Server components read the full catalogue from the request config, so
 * the client only needs the namespaces its own components translate with.
 * Route-specific namespaces (`settings`, `admin`) are added by their layouts.
 */

type Messages = Record<string, unknown>

/** Namespaces client components use on any page. */
export const CLIENT_NAMESPACES = [
	'achievements',
	'auth',
	'common',
	'consent',
	'daily',
	'gameResult',
	'games',
	'home',
	'leaderboard',
	'modes',
	'nav',
	'onboarding',
	'plus',
	'pwa',
	'share',
	'stats',
	'streak',
] as const

/** Keep only the named top-level namespaces; unknown names are ignored. */
export function pickMessages(messages: Messages, namespaces: readonly string[]): Messages {
	const picked: Messages = {}
	for (const namespace of namespaces) {
		if (namespace in messages) picked[namespace] = messages[namespace]
	}
	return picked
}
