/**
 * Where a player manages their email, password, sign-in methods, privacy and
 * account deletion.
 *
 * That will be Auth's hosted Account Portal, passed in by a server component
 * once Auth publishes its URL. Until then the links open Puzzled's support
 * page, where the team handles these requests. Players are never sent to a
 * Sylphx console.
 */
export type AccountPortalLink = { href: string; external: boolean }

export function accountPortalLink(configured?: string): AccountPortalLink {
	const value = configured?.trim()
	if (value) {
		try {
			const url = new URL(value)
			if (url.protocol === 'https:') return { href: url.toString(), external: true }
		} catch {
			// Not a URL: fall through to the support page.
		}
	}
	return { href: '/support', external: false }
}

/** Anchor attributes for the link: a new tab only when it leaves the app. */
export function accountPortalAnchor(link: AccountPortalLink) {
	return link.external
		? { href: link.href, target: '_blank', rel: 'noopener noreferrer' }
		: { href: link.href }
}
