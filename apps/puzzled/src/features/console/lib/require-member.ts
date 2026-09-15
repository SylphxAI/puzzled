import { redirect } from '@/lib/i18n/routing'
import type { IdentityUser } from '@/lib/identity/dest'
import { currentUser } from '@/lib/identity/server'
import { withPresentationDeadline } from '@/lib/presentation-document'

/**
 * Server guard for the signed-in console.
 *
 * Every console page calls this itself rather than relying on the settings
 * layout alone: layouts and pages render concurrently, so a page-level check is
 * what keeps account content out of an anonymous response. The redirect is
 * locale-aware, so a visitor on a prefixed URL comes back to the right one.
 */
export async function requireMember(input: {
	locale: string
	returnTo: string
}): Promise<IdentityUser | null> {
	const user = await withPresentationDeadline(currentUser(), null)
	if (!user) {
		redirect({
			href: { pathname: '/login', query: { callbackUrl: input.returnTo } },
			locale: input.locale,
		})
		// `redirect` throws; returning keeps narrowing honest if it ever resolves.
		return null
	}
	return user
}
