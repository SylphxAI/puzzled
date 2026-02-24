import { validateEnv } from '@/lib/env'

export async function register() {
	// Validate environment variables at startup
	// Fails fast with clear error if required vars missing
	validateEnv()
}

// Note: Request errors are captured via platform monitoring in individual handlers
// See src/lib/monitoring.ts for server-side error tracking
