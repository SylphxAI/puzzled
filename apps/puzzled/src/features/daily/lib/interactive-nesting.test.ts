import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const CRITICAL_JOURNEY_FILES = [
	new URL('../components/minimal-header.tsx', import.meta.url),
	new URL('../components/already-completed-view.tsx', import.meta.url),
	new URL('../../../app/[locale]/(main)/page.tsx', import.meta.url),
	new URL('../../../app/[locale]/(main)/games/[slug]/page.tsx', import.meta.url),
]

describe('critical daily journey interaction semantics', () => {
	test('does not nest Button controls inside navigation Links', () => {
		for (const file of CRITICAL_JOURNEY_FILES) {
			const source = readFileSync(file, 'utf8')
			expect(source, file.pathname).not.toMatch(
				/<Link\b[^>]*>(?:(?!<\/Link>)[\s\S]){0,240}<Button\b/,
			)
		}
	})
})
