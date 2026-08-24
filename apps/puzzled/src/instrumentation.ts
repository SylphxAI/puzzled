import { validateEnv } from '@/lib/env'

export async function register() {
	// Presentation boot: do not fail-close on api-owned or Platform root secrets.
	// DATABASE_URL / REDIS_URL belong to api. SYLPHX_SECRET_KEY is not injected
	// without an explicit BaaS binding (ADR-3418). HTTP listen is the postcondition.
	validateEnv()
}
