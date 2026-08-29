/**
 * Presentation HTTP boot helpers.
 *
 * Auth/SDK is optional at listen time. Knative probes GET `/`; a missing
 * Platform root secret must not 500 the public home.
 */

export type EnvSource = Record<string, string | undefined>

export function sylphxAuthConfigured(env: EnvSource = process.env): boolean {
	return Boolean(env.IDENTITY_API_KEY?.trim() || env.IDENTITY_ORGANIZATION_ID?.trim())
}
