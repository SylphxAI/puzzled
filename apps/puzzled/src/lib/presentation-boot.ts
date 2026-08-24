/**
 * Presentation HTTP boot helpers.
 *
 * Auth/SDK is optional at listen time. Knative probes GET `/`; a missing
 * Platform root secret must not 500 the public home.
 */

export type EnvSource = Record<string, string | undefined>

export function sylphxAuthConfigured(env: EnvSource = process.env): boolean {
	return Boolean(env.SYLPHX_SECRET_KEY?.trim() || env.SYLPHX_SECRET_URL?.trim())
}
