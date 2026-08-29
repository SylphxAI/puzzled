export function destProductCredential(
	names: readonly string[],
	env: Record<string, string | undefined> = process.env,
): string | undefined {
	for (const name of names) {
		const value = env[name]?.trim()
		if (value) return value
	}
	return undefined
}

export function destIdentityCredential(
	env: Record<string, string | undefined> = process.env,
): string | undefined {
	return destProductCredential(['IDENTITY_API_KEY'], env)
}

export function destIdentityProjectId(
	env: Record<string, string | undefined> = process.env,
): string | undefined {
	return destProductCredential(
		['IDENTITY_ORGANIZATION_ID', 'IDENTITY_PROJECT_ID', 'SYLPHX_PROJECT_ID'],
		env,
	)
}

export function destCommerceCredential(
	env: Record<string, string | undefined> = process.env,
): string | undefined {
	return destProductCredential(['COMMERCE_API_KEY', 'IDENTITY_API_KEY'], env)
}

export function destEventsCredential(
	env: Record<string, string | undefined> = process.env,
): string | undefined {
	return destProductCredential(['EVENTS_API_KEY', 'IDENTITY_API_KEY'], env)
}

export function destObservabilityCredential(
	env: Record<string, string | undefined> = process.env,
): string | undefined {
	return destProductCredential(['OBSERVABILITY_API_KEY', 'IDENTITY_API_KEY'], env)
}

export function requireDestIdentityCredential(
	env: Record<string, string | undefined> = process.env,
): string {
	const credential = destIdentityCredential(env)
	if (!credential) {
		throw new Error('Identity dest requires IDENTITY_API_KEY')
	}
	return credential
}

export function requireDestIdentityProjectId(
	env: Record<string, string | undefined> = process.env,
): string {
	const projectId = destIdentityProjectId(env)
	if (!projectId) {
		throw new Error('Identity dest requires IDENTITY_ORGANIZATION_ID')
	}
	return projectId
}
