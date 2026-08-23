import { validateEnv } from '@/lib/env'

export async function register() {
	// Presentation boot: fail only on web-owned required vars.
	// DATABASE_URL / REDIS_URL are api-owned and must not crash this process.
	validateEnv()
}
