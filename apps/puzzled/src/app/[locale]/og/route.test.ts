import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { getAllGameMetadata } from '@/games/registry'
import { locales } from '@/lib/i18n/config'
import { resolveLocale } from '../../../../scripts/i18n-resolved-catalogue'

const APP_ROOT = join(import.meta.dir, '../../../..')

describe('OG, JSON-LD and manifest free-tier truth alignment', () => {
	const gameCount = getAllGameMetadata().length

	test('layout JSON-LD, OG fallback badge and manifest state "Any 3 of 19" instead of "One free puzzle"', () => {
		const layoutSource = readFileSync(join(APP_ROOT, 'src/app/[locale]/layout.tsx'), 'utf8')
		const ogSource = readFileSync(join(APP_ROOT, 'src/app/[locale]/og/route.tsx'), 'utf8')
		const webAppJsonLdSource = readFileSync(
			join(APP_ROOT, 'src/features/home/components/web-application-json-ld.tsx'),
			'utf8',
		)
		const manifest = JSON.parse(
			readFileSync(join(APP_ROOT, 'public/manifest.webmanifest'), 'utf8'),
		) as { description: string }

		expect(layoutSource).not.toMatch(/One free puzzle/i)
		expect(layoutSource).toMatch(
			/Any 3 of \$\{getAllGameMetadata\(\)\.length\} puzzles free every day/,
		)
		expect(ogSource).not.toMatch(/Free puzzle every day|One free puzzle/i)
		expect(ogSource).toMatch(/Any 3 of \$\{getAllGameMetadata\(\)\.length\} puzzles free every day/)
		expect(webAppJsonLdSource).toMatch(/Any 3 of \$\{gameCount\} puzzles free every day/)
		expect(manifest.description).toContain(`Any 3 of ${gameCount} puzzles free every day`)
		expect(manifest.description).not.toMatch(/One free puzzle/i)
	})

	test('every locale home OG copy and auth trustFree reflect 3 of 19 free puzzles, never 1', () => {
		for (const locale of locales) {
			const messages = resolveLocale(locale) as {
				home: {
					metaDescription: string
					hero: { guestTitle: string; ogEyebrow: string; ogBadge: string }
				}
				auth: { brandPanel: { title: string; trustFree: string } }
			}
			expect(messages.home.metaDescription).toContain('3')
			expect(messages.home.metaDescription).toContain(String(gameCount))
			expect(messages.home.hero.guestTitle).toContain('3')
			expect(messages.home.hero.guestTitle).toContain(String(gameCount))
			expect(messages.home.hero.ogEyebrow).toContain(String(gameCount))
			expect(messages.home.hero.ogBadge).toContain('3')
			expect(messages.auth.brandPanel.trustFree).toContain('3')
			expect(messages.auth.brandPanel.trustFree).toContain(String(gameCount))
		}
	})
})
