/**
 * OAuth Provider Configuration
 *
 * Re-exports from @sylphx/auth/oauth.
 * Single source of truth for all OAuth provider settings.
 */

export {
	getBetterAuthSocialProviders,
	getEnabledOAuthProviderKeys,
	getEnabledOAuthProviders,
	getOAuthProviderDisplayName,
	isOAuthProviderEnabled,
	OAUTH_PROVIDER_DISPLAY_NAMES,
	OAUTH_PROVIDER_ENV_VARS,
	type OAuthProviderKey,
} from '@sylphx/auth/oauth'
