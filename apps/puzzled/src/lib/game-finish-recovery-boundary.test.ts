import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const gamePaths = ['cryptogram', 'word-box', 'word-search'].map(
	(game) => new URL(`../games/${game}/${game}-game.tsx`, import.meta.url),
)

describe('game finish recovery boundary', () => {
	test('keeps rejected Rust/Connect finishes visible and retryable in every affected module', () => {
		for (const gamePath of gamePaths) {
			const source = readFileSync(gamePath, 'utf8')

			expect(source).toContain("setSubmitError(tCommon('errorDescription'))")
			expect(source).toContain('role="alert"')
			expect(source).not.toContain('if (result.success) return')
		}
	})
})
