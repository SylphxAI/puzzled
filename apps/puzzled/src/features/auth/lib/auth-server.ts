import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { auth } from './auth'

/**
 * Get the current session on the server side (memoized per request)
 * Returns null if not authenticated
 *
 * Uses React cache to avoid duplicate DB calls when called from
 * both layout and page components in the same request.
 */
export const getServerSession = cache(async () => {
	const headersList = await headers()
	const session = await auth.api.getSession({
		headers: headersList,
	})
	return session
})

/**
 * Get the current user on the server side (memoized per request)
 * Returns null if not authenticated
 */
export async function getServerUser() {
	const session = await getServerSession()
	return session?.user ?? null
}

/**
 * Get the current user, asserting they are authenticated
 * Use this in pages where the layout already handles auth redirects.
 * Throws redirect to login if not authenticated (should never happen
 * if layout is properly configured).
 *
 * @param locale - Current locale for redirect URL
 * @throws Redirects to login page if not authenticated
 */
export async function requireServerUser(locale: string) {
	const user = await getServerUser()
	if (!user) {
		redirect(`/${locale}/login`)
	}
	return user
}
