import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// Sticky and fixed bars that page content scrolls under. A translucent surface
// lets the text behind it show through as ghost text (and backdrop-filter is not
// honoured everywhere), so each bar uses the opaque page background.
const SRC = join(import.meta.dir, '../../..')
const CHROME = [
	'shared/components/layout/top-nav.tsx',
	'shared/components/layout/bottom-nav.tsx',
	'features/daily/components/minimal-header.tsx',
	'app/[locale]/(main)/layout.tsx',
] as const

describe('scrolled-under chrome is opaque', () => {
	test.each([...CHROME])('%s', (file) => {
		const source = readFileSync(join(SRC, file), 'utf8')
		const bars = source
			.split('\n')
			.filter((line) => /\b(sticky|fixed)\b/.test(line) && /\bbg-background\b/.test(line))
		expect(bars.length).toBeGreaterThan(0)
		for (const line of bars) {
			expect(line).not.toMatch(/\bbg-background\/\d+/)
			expect(line).not.toMatch(/\bbackdrop-blur/)
		}
	})
})
