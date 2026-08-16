import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const NAVIGATION_SURFACE_FILES = [
	new URL('../components/minimal-header.tsx', import.meta.url),
	new URL('../components/already-completed-view.tsx', import.meta.url),
	new URL('../../../app/[locale]/(main)/page.tsx', import.meta.url),
	new URL('../../../app/[locale]/(main)/games/[slug]/page.tsx', import.meta.url),
	new URL('../../../app/[locale]/verify-email/page.tsx', import.meta.url),
	new URL('../../../app/[locale]/(auth)/forgot-password/page.tsx', import.meta.url),
	new URL('../../../app/[locale]/(auth)/reset-password/page.tsx', import.meta.url),
	new URL('../../../app/[locale]/(auth)/signup/signup-form.tsx', import.meta.url),
	new URL('../../../app/[locale]/(main)/pricing/pricing-client.tsx', import.meta.url),
	new URL('../../../app/[locale]/unsubscribe/page.tsx', import.meta.url),
]

describe('navigation interaction semantics', () => {
	test('does not nest Button controls inside navigation Links', () => {
		for (const file of NAVIGATION_SURFACE_FILES) {
			const source = readFileSync(file, 'utf8')
			expect(source, file.pathname).not.toMatch(
				/<Link\b[^>]*>(?:(?!<\/Link>)[\s\S]){0,240}<Button\b/,
			)
		}
	})
})
