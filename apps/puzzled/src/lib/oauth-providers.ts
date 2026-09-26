import { getOAuthProviders, type OAuthProvider } from '@/lib/identity/app-config'

/**
 * Social sign-in buttons for the auth pages: the providers Puzzled's Sylphx
 * Auth instance can use now, read on the server (no build-time value).
 */
export async function loadOAuthProviders(): Promise<OAuthProvider[]> {
	return getOAuthProviders()
}
