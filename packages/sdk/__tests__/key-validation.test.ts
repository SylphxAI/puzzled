/**
 * API Key Validation Tests
 *
 * Tests for key validation, sanitization, and environment detection.
 * These are critical for SDK initialization - must be bulletproof.
 */

import { describe, test, expect, beforeEach, afterEach, spyOn } from 'bun:test'
import {
	validateAppId,
	validateSecretKey,
	validateKey,
	validateAndSanitizeAppId,
	validateAndSanitizeSecretKey,
	validateAndSanitizeKey,
	detectEnvironment,
	isDevelopmentKey,
	isProductionKey,
	getCookieNamespace,
	detectKeyType,
	isAppId,
	isSecretKey,
	isDevelopmentRuntime,
	type KeyValidationResult,
	type EnvironmentType,
} from '../src/key-validation'

// ============================================================================
// Test Data
// ============================================================================

const VALID_APP_IDS = {
	dev: 'app_dev_abc123def456',
	stg: 'app_stg_xyz789ghi012',
	prod: 'app_prod_jkl345mno678',
	devHex: 'app_dev_0123456789abcdef0123456789abcdef',
	platform: 'app_dev_platform_sylphx-console',
}

const VALID_SECRET_KEYS = {
	dev: 'sk_dev_abc123def456',
	stg: 'sk_stg_xyz789ghi012',
	prod: 'sk_prod_jkl345mno678',
	prodHex: 'sk_prod_0123456789abcdef0123456789abcdef',
	platform: 'sk_prod_platform_sylphx-console',
}

const INVALID_KEYS = {
	empty: '',
	null: null as string | null,
	undefined: undefined as string | undefined,
	whitespaceOnly: '   ',
	wrongPrefix: 'pk_dev_abc123', // pk_ is deprecated
	missingEnv: 'app_abc123',
	invalidEnv: 'app_test_abc123', // 'test' is not valid
	uppercase: 'APP_DEV_abc123',
	mixed: 'App_Dev_Abc123',
	specialChars: 'app_dev_abc!@#$%',
}

// ============================================================================
// validateAppId Tests
// ============================================================================

describe('validateAppId', () => {
	describe('valid App IDs', () => {
		test('validates development App ID', () => {
			const result = validateAppId(VALID_APP_IDS.dev)
			expect(result.valid).toBe(true)
			expect(result.sanitizedKey).toBe(VALID_APP_IDS.dev)
			expect(result.keyType).toBe('appId')
			expect(result.environment).toBe('development')
			expect(result.error).toBeUndefined()
			expect(result.warning).toBeUndefined()
		})

		test('validates staging App ID', () => {
			const result = validateAppId(VALID_APP_IDS.stg)
			expect(result.valid).toBe(true)
			expect(result.environment).toBe('staging')
		})

		test('validates production App ID', () => {
			const result = validateAppId(VALID_APP_IDS.prod)
			expect(result.valid).toBe(true)
			expect(result.environment).toBe('production')
		})

		test('validates hex identifier App ID', () => {
			const result = validateAppId(VALID_APP_IDS.devHex)
			expect(result.valid).toBe(true)
		})

		test('validates platform App ID with hyphens', () => {
			const result = validateAppId(VALID_APP_IDS.platform)
			expect(result.valid).toBe(true)
		})
	})

	describe('sanitization (auto-fix)', () => {
		test('sanitizes leading whitespace', () => {
			const result = validateAppId('  app_dev_abc123')
			expect(result.valid).toBe(true)
			expect(result.sanitizedKey).toBe('app_dev_abc123')
			expect(result.warning).toContain('whitespace')
			expect(result.issues).toContain('whitespace')
		})

		test('sanitizes trailing whitespace', () => {
			const result = validateAppId('app_dev_abc123  ')
			expect(result.valid).toBe(true)
			expect(result.sanitizedKey).toBe('app_dev_abc123')
		})

		test('sanitizes newline characters', () => {
			const result = validateAppId('app_dev_abc123\n')
			expect(result.valid).toBe(true)
			expect(result.sanitizedKey).toBe('app_dev_abc123')
			expect(result.warning).toContain('newline')
		})

		test('sanitizes carriage return', () => {
			const result = validateAppId('app_dev_abc123\r')
			expect(result.valid).toBe(true)
			expect(result.warning).toContain('carriage-return')
		})

		test('sanitizes uppercase characters', () => {
			const result = validateAppId('APP_DEV_abc123')
			expect(result.valid).toBe(true)
			expect(result.sanitizedKey).toBe('app_dev_abc123')
			expect(result.warning).toContain('uppercase')
		})

		test('sanitizes mixed case', () => {
			const result = validateAppId('App_Dev_Abc123')
			expect(result.valid).toBe(true)
			expect(result.sanitizedKey).toBe('app_dev_abc123')
		})

		test('sanitizes combined issues', () => {
			const result = validateAppId('  APP_DEV_abc123\n')
			expect(result.valid).toBe(true)
			expect(result.sanitizedKey).toBe('app_dev_abc123')
			expect(result.issues).toContain('whitespace')
			expect(result.issues).toContain('uppercase-chars')
			expect(result.issues).toContain('newline')
		})

		test('warning message includes fix instructions', () => {
			const result = validateAppId('APP_DEV_abc123\n')
			expect(result.warning).toContain('Vercel CLI')
			expect(result.warning).toContain('NEXT_PUBLIC_SYLPHX_APP_ID')
			expect(result.warning).toContain('sanitize')
		})
	})

	describe('invalid App IDs', () => {
		test('rejects empty string', () => {
			const result = validateAppId('')
			expect(result.valid).toBe(false)
			expect(result.error).toContain('required')
		})

		test('rejects null', () => {
			const result = validateAppId(null)
			expect(result.valid).toBe(false)
			expect(result.error).toContain('required')
		})

		test('rejects undefined', () => {
			const result = validateAppId(undefined)
			expect(result.valid).toBe(false)
			expect(result.error).toContain('required')
		})

		test('rejects whitespace only', () => {
			const result = validateAppId('   ')
			expect(result.valid).toBe(false)
		})

		test('rejects wrong prefix (pk_)', () => {
			const result = validateAppId('pk_dev_abc123')
			expect(result.valid).toBe(false)
			expect(result.error).toContain('Invalid')
		})

		test('rejects secret key prefix (sk_)', () => {
			const result = validateAppId('sk_dev_abc123')
			expect(result.valid).toBe(false)
		})

		test('rejects missing environment', () => {
			const result = validateAppId('app_abc123')
			expect(result.valid).toBe(false)
		})

		test('rejects invalid environment', () => {
			const result = validateAppId('app_test_abc123')
			expect(result.valid).toBe(false)
		})

		test('rejects special characters', () => {
			const result = validateAppId('app_dev_abc!@#')
			expect(result.valid).toBe(false)
		})

		test('error message includes helpful hints', () => {
			const result = validateAppId('invalid_key')
			expect(result.error).toContain('Expected format')
			expect(result.error).toContain('app_')
			expect(result.error).toContain('dev|stg|prod')
			expect(result.error).toContain('NEXT_PUBLIC_SYLPHX_APP_ID')
		})
	})
})

// ============================================================================
// validateSecretKey Tests
// ============================================================================

describe('validateSecretKey', () => {
	describe('valid Secret Keys', () => {
		test('validates development secret key', () => {
			const result = validateSecretKey(VALID_SECRET_KEYS.dev)
			expect(result.valid).toBe(true)
			expect(result.sanitizedKey).toBe(VALID_SECRET_KEYS.dev)
			expect(result.keyType).toBe('secret')
			expect(result.environment).toBe('development')
		})

		test('validates staging secret key', () => {
			const result = validateSecretKey(VALID_SECRET_KEYS.stg)
			expect(result.valid).toBe(true)
			expect(result.environment).toBe('staging')
		})

		test('validates production secret key', () => {
			const result = validateSecretKey(VALID_SECRET_KEYS.prod)
			expect(result.valid).toBe(true)
			expect(result.environment).toBe('production')
		})

		test('validates hex identifier secret key', () => {
			const result = validateSecretKey(VALID_SECRET_KEYS.prodHex)
			expect(result.valid).toBe(true)
		})

		test('validates platform secret key', () => {
			const result = validateSecretKey(VALID_SECRET_KEYS.platform)
			expect(result.valid).toBe(true)
		})
	})

	describe('sanitization', () => {
		test('sanitizes whitespace and newlines', () => {
			const result = validateSecretKey('  sk_dev_abc123\n')
			expect(result.valid).toBe(true)
			expect(result.sanitizedKey).toBe('sk_dev_abc123')
			expect(result.warning).toBeTruthy()
		})

		test('sanitizes uppercase', () => {
			const result = validateSecretKey('SK_PROD_abc123')
			expect(result.valid).toBe(true)
			expect(result.sanitizedKey).toBe('sk_prod_abc123')
		})
	})

	describe('invalid Secret Keys', () => {
		test('rejects empty string', () => {
			const result = validateSecretKey('')
			expect(result.valid).toBe(false)
		})

		test('rejects null', () => {
			const result = validateSecretKey(null)
			expect(result.valid).toBe(false)
		})

		test('rejects App ID prefix (app_)', () => {
			const result = validateSecretKey('app_dev_abc123')
			expect(result.valid).toBe(false)
		})

		test('error references SYLPHX_SECRET_KEY', () => {
			const result = validateSecretKey('invalid')
			expect(result.error).toContain('SYLPHX_SECRET_KEY')
		})
	})
})

// ============================================================================
// validateKey Tests (Auto-detect)
// ============================================================================

describe('validateKey', () => {
	test('auto-detects App ID', () => {
		const result = validateKey(VALID_APP_IDS.dev)
		expect(result.valid).toBe(true)
		expect(result.keyType).toBe('appId')
	})

	test('auto-detects Secret Key', () => {
		const result = validateKey(VALID_SECRET_KEYS.dev)
		expect(result.valid).toBe(true)
		expect(result.keyType).toBe('secret')
	})

	test('rejects unknown prefix', () => {
		const result = validateKey('pk_dev_abc123')
		expect(result.valid).toBe(false)
		expect(result.error).toContain("start with 'app_'")
	})

	test('rejects empty key', () => {
		const result = validateKey('')
		expect(result.valid).toBe(false)
	})

	test('rejects null', () => {
		const result = validateKey(null)
		expect(result.valid).toBe(false)
		expect(result.error).toContain('required')
	})
})

// ============================================================================
// validateAndSanitize* Tests (Throwing versions)
// ============================================================================

describe('validateAndSanitizeAppId', () => {
	let consoleSpy: ReturnType<typeof spyOn>

	beforeEach(() => {
		consoleSpy = spyOn(console, 'warn').mockImplementation(() => {})
	})

	afterEach(() => {
		consoleSpy.mockRestore()
	})

	test('returns sanitized key for valid input', () => {
		const result = validateAndSanitizeAppId(VALID_APP_IDS.dev)
		expect(result).toBe(VALID_APP_IDS.dev)
	})

	test('sanitizes and warns on fixable issues', () => {
		const result = validateAndSanitizeAppId('APP_DEV_abc123\n')
		expect(result).toBe('app_dev_abc123')
		expect(consoleSpy).toHaveBeenCalled()
	})

	test('throws on invalid input', () => {
		expect(() => validateAndSanitizeAppId('')).toThrow()
		expect(() => validateAndSanitizeAppId(null)).toThrow()
		expect(() => validateAndSanitizeAppId('invalid')).toThrow()
	})
})

describe('validateAndSanitizeSecretKey', () => {
	let consoleSpy: ReturnType<typeof spyOn>

	beforeEach(() => {
		consoleSpy = spyOn(console, 'warn').mockImplementation(() => {})
	})

	afterEach(() => {
		consoleSpy.mockRestore()
	})

	test('returns sanitized key for valid input', () => {
		const result = validateAndSanitizeSecretKey(VALID_SECRET_KEYS.dev)
		expect(result).toBe(VALID_SECRET_KEYS.dev)
	})

	test('throws on invalid input', () => {
		expect(() => validateAndSanitizeSecretKey('')).toThrow()
		expect(() => validateAndSanitizeSecretKey('app_dev_abc123')).toThrow()
	})
})

describe('validateAndSanitizeKey', () => {
	let consoleSpy: ReturnType<typeof spyOn>

	beforeEach(() => {
		consoleSpy = spyOn(console, 'warn').mockImplementation(() => {})
	})

	afterEach(() => {
		consoleSpy.mockRestore()
	})

	test('returns sanitized App ID', () => {
		const result = validateAndSanitizeKey(VALID_APP_IDS.dev)
		expect(result).toBe(VALID_APP_IDS.dev)
	})

	test('returns sanitized Secret Key', () => {
		const result = validateAndSanitizeKey(VALID_SECRET_KEYS.dev)
		expect(result).toBe(VALID_SECRET_KEYS.dev)
	})

	test('throws on invalid input', () => {
		expect(() => validateAndSanitizeKey('')).toThrow()
	})
})

// ============================================================================
// detectEnvironment Tests
// ============================================================================

describe('detectEnvironment', () => {
	test('detects development from App ID', () => {
		expect(detectEnvironment(VALID_APP_IDS.dev)).toBe('development')
	})

	test('detects staging from App ID', () => {
		expect(detectEnvironment(VALID_APP_IDS.stg)).toBe('staging')
	})

	test('detects production from App ID', () => {
		expect(detectEnvironment(VALID_APP_IDS.prod)).toBe('production')
	})

	test('detects development from Secret Key', () => {
		expect(detectEnvironment(VALID_SECRET_KEYS.dev)).toBe('development')
	})

	test('detects staging from Secret Key', () => {
		expect(detectEnvironment(VALID_SECRET_KEYS.stg)).toBe('staging')
	})

	test('detects production from Secret Key', () => {
		expect(detectEnvironment(VALID_SECRET_KEYS.prod)).toBe('production')
	})

	test('sanitizes before detecting', () => {
		expect(detectEnvironment('APP_DEV_abc123')).toBe('development')
		expect(detectEnvironment('  sk_prod_abc123\n')).toBe('production')
	})

	test('throws on invalid key', () => {
		expect(() => detectEnvironment('invalid')).toThrow()
		expect(() => detectEnvironment('pk_dev_abc123')).toThrow()
	})
})

// ============================================================================
// isDevelopmentKey / isProductionKey Tests
// ============================================================================

describe('isDevelopmentKey', () => {
	test('returns true for dev keys', () => {
		expect(isDevelopmentKey(VALID_APP_IDS.dev)).toBe(true)
		expect(isDevelopmentKey(VALID_SECRET_KEYS.dev)).toBe(true)
	})

	test('returns false for non-dev keys', () => {
		expect(isDevelopmentKey(VALID_APP_IDS.prod)).toBe(false)
		expect(isDevelopmentKey(VALID_APP_IDS.stg)).toBe(false)
	})
})

describe('isProductionKey', () => {
	test('returns true for prod keys', () => {
		expect(isProductionKey(VALID_APP_IDS.prod)).toBe(true)
		expect(isProductionKey(VALID_SECRET_KEYS.prod)).toBe(true)
	})

	test('returns false for non-prod keys', () => {
		expect(isProductionKey(VALID_APP_IDS.dev)).toBe(false)
		expect(isProductionKey(VALID_APP_IDS.stg)).toBe(false)
	})
})

// ============================================================================
// getCookieNamespace Tests
// ============================================================================

describe('getCookieNamespace', () => {
	test('returns sylphx_dev for development', () => {
		expect(getCookieNamespace(VALID_SECRET_KEYS.dev)).toBe('sylphx_dev')
	})

	test('returns sylphx_stg for staging', () => {
		expect(getCookieNamespace(VALID_SECRET_KEYS.stg)).toBe('sylphx_stg')
	})

	test('returns sylphx_prod for production', () => {
		expect(getCookieNamespace(VALID_SECRET_KEYS.prod)).toBe('sylphx_prod')
	})

	test('works with App IDs too', () => {
		expect(getCookieNamespace('app_dev_abc123')).toBe('sylphx_dev')
	})
})

// ============================================================================
// detectKeyType Tests
// ============================================================================

describe('detectKeyType', () => {
	test('detects appId type', () => {
		expect(detectKeyType(VALID_APP_IDS.dev)).toBe('appId')
		expect(detectKeyType(VALID_APP_IDS.prod)).toBe('appId')
	})

	test('detects secret type', () => {
		expect(detectKeyType(VALID_SECRET_KEYS.dev)).toBe('secret')
		expect(detectKeyType(VALID_SECRET_KEYS.prod)).toBe('secret')
	})

	test('returns null for unknown type', () => {
		expect(detectKeyType('pk_dev_abc123')).toBe(null)
		expect(detectKeyType('invalid')).toBe(null)
	})

	test('handles whitespace and case', () => {
		expect(detectKeyType('  APP_DEV_abc123')).toBe('appId')
		expect(detectKeyType('SK_PROD_abc123\n')).toBe('secret')
	})
})

// ============================================================================
// isAppId / isSecretKey Tests
// ============================================================================

describe('isAppId', () => {
	test('returns true for App IDs', () => {
		expect(isAppId(VALID_APP_IDS.dev)).toBe(true)
		expect(isAppId(VALID_APP_IDS.prod)).toBe(true)
	})

	test('returns false for Secret Keys', () => {
		expect(isAppId(VALID_SECRET_KEYS.dev)).toBe(false)
	})

	test('returns false for invalid keys', () => {
		expect(isAppId('invalid')).toBe(false)
	})
})

describe('isSecretKey', () => {
	test('returns true for Secret Keys', () => {
		expect(isSecretKey(VALID_SECRET_KEYS.dev)).toBe(true)
		expect(isSecretKey(VALID_SECRET_KEYS.prod)).toBe(true)
	})

	test('returns false for App IDs', () => {
		expect(isSecretKey(VALID_APP_IDS.dev)).toBe(false)
	})

	test('returns false for invalid keys', () => {
		expect(isSecretKey('invalid')).toBe(false)
	})
})

// ============================================================================
// isDevelopmentRuntime Tests
// ============================================================================

describe('isDevelopmentRuntime', () => {
	test('returns boolean', () => {
		const result = isDevelopmentRuntime()
		expect(typeof result).toBe('boolean')
	})

	// Note: The actual value depends on NODE_ENV during test execution
	// In bun test, NODE_ENV is typically 'test' not 'development'
	test('checks NODE_ENV', () => {
		// This test just verifies the function runs without error
		// The actual behavior depends on the runtime environment
		expect(() => isDevelopmentRuntime()).not.toThrow()
	})
})

// ============================================================================
// Edge Cases and Security Tests
// ============================================================================

describe('Edge Cases', () => {
	test('handles very long keys', () => {
		const longKey = `app_dev_${'a'.repeat(1000)}`
		const result = validateAppId(longKey)
		expect(result.valid).toBe(true)
	})

	test('handles Unicode characters', () => {
		const result = validateAppId('app_dev_abc\u0000123')
		// Should reject invalid characters
		expect(result.valid).toBe(false)
	})

	test('handles tab characters', () => {
		const result = validateAppId('app_dev_abc123\t')
		expect(result.valid).toBe(true) // trim removes tabs
		expect(result.sanitizedKey).toBe('app_dev_abc123')
	})

	test('rejects keys with spaces in middle', () => {
		const result = validateAppId('app_dev_abc 123')
		expect(result.valid).toBe(false)
	})

	test('handles multiple underscores', () => {
		const result = validateAppId('app_dev_platform_my_app_name')
		expect(result.valid).toBe(true)
	})

	test('handles hyphens in identifier', () => {
		const result = validateAppId('app_dev_my-app-name')
		expect(result.valid).toBe(true)
	})
})

describe('Security', () => {
	test('masks key in error messages', () => {
		const longKey = 'app_invalid_' + 'a'.repeat(50)
		const result = validateAppId(longKey)
		if (result.error) {
			// Error should not expose the full key
			expect(result.error).toContain('...')
			expect(result.error).not.toContain('a'.repeat(50))
		}
	})

	test('does not log sanitized key in warning', () => {
		const result = validateAppId('APP_DEV_supersecretkey123\n')
		if (result.warning) {
			// Warning should not expose the actual key value
			expect(result.warning).not.toContain('supersecretkey123')
		}
	})
})

// ============================================================================
// Consistency Tests
// ============================================================================

describe('Consistency', () => {
	test('all environments use same validation rules', () => {
		const envs = ['dev', 'stg', 'prod']
		for (const env of envs) {
			// App ID
			const appResult = validateAppId(`app_${env}_abc123`)
			expect(appResult.valid).toBe(true)

			// Secret Key
			const skResult = validateSecretKey(`sk_${env}_abc123`)
			expect(skResult.valid).toBe(true)
		}
	})

	test('sanitization is idempotent', () => {
		const dirtyKey = '  APP_DEV_abc123\n'
		const result1 = validateAppId(dirtyKey)
		const result2 = validateAppId(result1.sanitizedKey)

		expect(result1.sanitizedKey).toBe(result2.sanitizedKey)
		expect(result2.warning).toBeUndefined() // Second pass should have no warnings
	})

	test('environment detection matches validation result', () => {
		const result = validateAppId(VALID_APP_IDS.prod)
		const env = detectEnvironment(VALID_APP_IDS.prod)
		expect(result.environment).toBe(env)
	})
})
