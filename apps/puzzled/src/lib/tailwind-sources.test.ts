/**
 * Tailwind source guard.
 *
 * Regression this exists for: the shared ui package sits outside the app
 * directory, so Tailwind v4's automatic source detection never scanned it and
 * classes used only there (the Dialog's `sm:left-1/2`, `sm:top-1/2`, ...) were
 * missing from the built CSS. On desktop the finish result dialog then rendered
 * docked to the left edge with its top cut off.
 *
 * The test compiles globals.css the way the app build does and checks the
 * utilities that only the ui package uses are emitted.
 */
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import tailwindPostcss from '@tailwindcss/postcss'
import postcss, { type AcceptedPlugin } from 'postcss'

const APP_DIR = join(import.meta.dir, '..', '..')
const GLOBALS_CSS = join(APP_DIR, 'src', 'app', 'globals.css')

describe('tailwind sources', () => {
	test('utilities used only by packages/ui are emitted', async () => {
		const previous = process.cwd()
		process.chdir(APP_DIR)
		try {
			const result = await postcss([tailwindPostcss() as unknown as AcceptedPlugin]).process(
				readFileSync(GLOBALS_CSS, 'utf8'),
				{
					from: GLOBALS_CSS,
				},
			)
			for (const utility of [
				'sm\\:left-1\\/2',
				'sm\\:top-1\\/2',
				'sm\\:-translate-x-1\\/2',
				'sm\\:inset-x-auto',
			]) {
				expect(result.css).toContain(`.${utility}`)
			}
		} finally {
			process.chdir(previous)
		}
	})
})
