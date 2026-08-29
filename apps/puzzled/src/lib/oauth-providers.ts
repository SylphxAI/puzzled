import { getOAuthProviders, type OAuthProvider } from '@/lib/identity/server'

/**
 * Load enabled OAuth providers for auth pages.
 *
 * NEXT_PUBLIC_SYLPHX_APP_ID is baked at image build. Live web may have the
 * runtime secret while the compiled page still sees an empty App ID; do not
 * fail the login surface with 500 — serve password sign-in with no OAuth
 * buttons until the baked App ID is present.
 */
export async function loadOAuthProviders(
	appId: string | undefined = process.env.NEXT_PUBLIC_SYLPHX_APP_ID,
): Promise<OAuthProvider[]> {
	if (!appId?.trim()) return []
	return getOAuthProviders({ appId })
}
