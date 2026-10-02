import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The mailed links carry `challenge_id` and `token`. These source assertions pin
 * the pages and the hook to that contract so neither can fall back to a lone
 * `token`, and verification can never run on page load.
 */
const src = (path: string) => readFileSync(join(import.meta.dir, '../..', path), 'utf8')

describe('mailed link consumption', () => {
	test('reset form reads challenge_id and token and needs both', () => {
		const form = src('app/[locale]/(auth)/reset-password/reset-password-form.tsx')
		expect(form).toContain("searchParams.get('challenge_id')")
		expect(form).toContain("searchParams.get('token')")
		expect(form).toMatch(/!token \|\| !challengeId/)
	})

	test('reset hook posts challengeId and the token as the secret, never the token as challenge', () => {
		const hook = src('lib/identity/react.tsx')
		expect(hook).toContain('challengeId: opts?.challengeId')
		expect(hook).toContain('secret: opts?.token')
		expect(hook).not.toMatch(/challengeId:\s*opts\?\.token/)
	})

	test('verify page confirms only from a click, not on load', () => {
		const page = src('app/[locale]/verify-email/page.tsx')
		expect(page).toContain("searchParams.get('challenge_id')")
		expect(page).toContain('onClick={handleConfirm}')
		expect(page).not.toContain('useEffect')
		expect(page.match(/verifyEmail\(/g)?.length).toBe(1)
	})

	test('resend and sign-up use uuidv7 and the real verify page', () => {
		expect(src('app/api/identity/verify-email/resend/route.ts')).toContain('uuidv7()')
		expect(src('app/api/identity/signup/route.ts')).toContain('/verify-email')
	})
})
