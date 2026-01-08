/**
 * Application Initialization
 *
 * Seeds initial configuration from environment variables on first run.
 * After initialization, all settings are managed via admin UI - no fallbacks.
 *
 * Environment Variables:
 * - INITIAL_SUPERADMIN_EMAIL: Email of user to auto-promote to super_admin on first sign-in
 * - PUZZLE_GENERATOR_MODEL: Initial LLM model (e.g., "anthropic/claude-sonnet-4")
 *
 * These are one-time seeds. After first run, admin UI is the source of truth.
 */

import 'server-only'

import { eq } from 'drizzle-orm'
import { logRoleChange } from '@/lib/audit'
import { OPENROUTER_API_URL } from '@/lib/config/app'
import { db } from '@/lib/db'
import { appSettings, users } from '@/lib/db/schema'
import { ROLE_SUPER_ADMIN, ROLE_USER } from '@/lib/roles'

// ==========================================
// Types
// ==========================================

export type InitializationResult = {
	superadmin: { initialized: boolean; email?: string; error?: string }
	model: { initialized: boolean; model?: string; error?: string }
}

// ==========================================
// Superadmin Initialization
// ==========================================

/**
 * Check if any super_admin exists in the system
 */
async function hasSuperAdmin(): Promise<boolean> {
	const result = await db
		.select({ id: users.id })
		.from(users)
		.where(eq(users.role, ROLE_SUPER_ADMIN))
		.limit(1)
	return result.length > 0
}

/**
 * Auto-promote user to super_admin if:
 * 1. INITIAL_SUPERADMIN_EMAIL is set
 * 2. No super_admin exists yet
 * 3. User with that email exists
 *
 * Called on user sign-in to catch the first matching user.
 * Uses transaction to prevent race conditions.
 */
export async function tryAutoPromoteSuperAdmin(userEmail: string): Promise<boolean> {
	const targetEmail = process.env.INITIAL_SUPERADMIN_EMAIL?.toLowerCase().trim()

	// No env configured
	if (!targetEmail) return false

	// Email doesn't match
	if (userEmail.toLowerCase() !== targetEmail) return false

	// Use transaction to prevent race condition between check and promote
	return await db.transaction(async (tx) => {
		// Check if any super_admin exists (within transaction)
		const existingSuperAdmin = await tx
			.select({ id: users.id })
			.from(users)
			.where(eq(users.role, ROLE_SUPER_ADMIN))
			.limit(1)

		if (existingSuperAdmin.length > 0) {
			return false // Already has super_admin
		}

		// Promote the user
		const [promotedUser] = await tx
			.update(users)
			.set({ role: ROLE_SUPER_ADMIN, updatedAt: new Date() })
			.where(eq(users.email, userEmail))
			.returning()

		if (promotedUser) {
			// Log outside transaction is fine - audit log is non-critical
			await logRoleChange(promotedUser.id, promotedUser.id, ROLE_USER, ROLE_SUPER_ADMIN)
			return true
		}

		return false
	})
}

// ==========================================
// App Settings Initialization
// ==========================================

type SettingDefinition = {
	key: string
	envVar: string
	description: string
	validate?: (value: string) => boolean
}

/**
 * Settings that can be seeded from environment variables
 */
const SEEDABLE_SETTINGS: SettingDefinition[] = [
	{
		key: 'puzzle_generator_model',
		envVar: 'PUZZLE_GENERATOR_MODEL',
		description: 'LLM model for puzzle generation (e.g., anthropic/claude-sonnet-4)',
		validate: (value) => value.includes('/'), // Must be provider/model format
	},
]

/**
 * Seed a single setting from env if not already set in database
 */
async function seedSettingFromEnv(
	setting: SettingDefinition,
): Promise<{ seeded: boolean; value?: string; error?: string }> {
	const envValue = process.env[setting.envVar]?.trim()

	// No env value
	if (!envValue) {
		return { seeded: false }
	}

	// Validate if validator exists
	if (setting.validate && !setting.validate(envValue)) {
		return { seeded: false, error: `Invalid ${setting.envVar} format: ${envValue}` }
	}

	// Check if already set in database
	const existing = await db.query.appSettings.findFirst({
		where: eq(appSettings.key, setting.key),
	})

	if (existing) {
		return { seeded: false } // Already configured via admin UI
	}

	// Seed the setting
	await db.insert(appSettings).values({
		key: setting.key,
		value: envValue,
		description: setting.description,
		updatedAt: new Date(),
	})

	console.log(`[Init] Seeded ${setting.key} from ${setting.envVar}: ${envValue}`)
	return { seeded: true, value: envValue }
}

/**
 * Initialize all seedable settings from environment variables
 * Call this on application startup (e.g., in middleware or API route)
 */
export async function initializeSettingsFromEnv(): Promise<
	Record<string, { seeded: boolean; value?: string; error?: string }>
> {
	const results: Record<string, { seeded: boolean; value?: string; error?: string }> = {}

	for (const setting of SEEDABLE_SETTINGS) {
		results[setting.key] = await seedSettingFromEnv(setting)
	}

	return results
}

// ==========================================
// Full Initialization
// ==========================================

/**
 * Run full initialization check
 * Returns status of what was/wasn't initialized
 */
export async function runInitialization(): Promise<InitializationResult> {
	const result: InitializationResult = {
		superadmin: { initialized: false },
		model: { initialized: false },
	}

	// Check superadmin status
	const targetEmail = process.env.INITIAL_SUPERADMIN_EMAIL?.toLowerCase().trim()
	if (targetEmail) {
		if (await hasSuperAdmin()) {
			result.superadmin = { initialized: true, email: '(already exists)' }
		} else {
			result.superadmin = { initialized: false, email: targetEmail }
		}
	}

	// Seed settings from env
	const settingsResult = await initializeSettingsFromEnv()
	if (settingsResult.puzzle_generator_model) {
		result.model = {
			initialized: settingsResult.puzzle_generator_model.seeded,
			model: settingsResult.puzzle_generator_model.value,
			error: settingsResult.puzzle_generator_model.error,
		}
	}

	return result
}

// ==========================================
// Validation Helpers
// ==========================================

/**
 * Validate model exists via OpenRouter API
 * Use this for admin UI autocomplete validation
 */
export async function validateModelExists(modelId: string): Promise<boolean> {
	try {
		const response = await fetch(`${OPENROUTER_API_URL}/models`)
		if (!response.ok) return false

		const data = await response.json()
		return data.data?.some((m: { id: string }) => m.id === modelId) ?? false
	} catch {
		return false
	}
}
