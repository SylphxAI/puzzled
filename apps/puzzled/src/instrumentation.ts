import { validateEnv } from '@/lib/env'

export async function register() {
	// Validate environment variables at startup
	// Fails fast with clear error if required vars missing
	validateEnv()
}
