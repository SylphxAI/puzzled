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
	return destProductCredential(['SYLPHX_AUTH_SECRET_KEY'], env)
}

export function destIdentityProjectId(
	env: Record<string, string | undefined> = process.env,
): string | undefined {
	return destProductCredential(['SYLPHX_AUTH_ORGANIZATION_ID'], env)
}

export function destEventsCredential(
	env: Record<string, string | undefined> = process.env,
): string | undefined {
	return destProductCredential(['EVENTS_API_KEY'], env)
}

export function destAiCredential(
	env: Record<string, string | undefined> = process.env,
): string | undefined {
	return destProductCredential(['AI_API_KEY'], env)
}

export function requireDestIdentityCredential(
	env: Record<string, string | undefined> = process.env,
): string {
	const credential = destIdentityCredential(env)
	if (!credential) {
		throw new Error('Sylphx Auth requires SYLPHX_AUTH_SECRET_KEY')
	}
	return credential
}

export function requireDestIdentityProjectId(
	env: Record<string, string | undefined> = process.env,
): string {
	const projectId = destIdentityProjectId(env)
	if (!projectId) {
		throw new Error('Sylphx Auth requires SYLPHX_AUTH_ORGANIZATION_ID')
	}
	return projectId
}
