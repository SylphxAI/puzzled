import { expect, test } from '@playwright/test'
import {
	DESKTOP,
	MOBILE,
	readActiveElement,
	SHELL_TARGET_SELECTOR,
	type Stop,
	sampleTransform,
	settle,
	targetOffenders,
} from './a11y-support'

/**
 * Behavioural accessibility coverage for the shell: keyboard operation, focus
 * management, target sizes and motion preferences.
 *
 * axe cannot see most of this (it has no notion of "where does focus go after
 * Escape", or "how big is the clickable area"), so it is measured directly in
 * the browser. Repairs these tests keep honest:
 *  - skip link present and working on every shell route,
 *  - one tab order through the shell, no zero-size or unnamed stops,
 *  - Escape closes the nav sheet, the rules dialog and the language menu, and
 *    focus returns to the trigger,
 *  - every shell control offers a 44px effective target (company bar),
 *  - `prefers-reduced-motion: reduce` stops transform animation while
 *    motion-enabled users keep it.
 */

test.describe('Skip link', () => {
	test.use({ viewport: DESKTOP })

	test('is the first tab stop and moves focus into the main region', async ({ page }) => {
		await page.goto('/', { waitUntil: 'domcontentloaded' })
		await settle(page)

		await page.keyboard.press('Tab')
		const skipLink = page.locator('a[href="#main-content"]')
		await expect(skipLink).toBeFocused()
		await expect(skipLink).toBeVisible()

		await page.keyboard.press('Enter')
		await expect(page.locator('#main-content')).toBeFocused()
	})
})

test.describe('Tab order through the shell', () => {
	test.use({ viewport: DESKTOP })

	test('reaches shell controls, navigation and page content without empty stops', async ({
		page,
	}) => {
		await page.goto('/', { waitUntil: 'domcontentloaded' })
		await settle(page)

		const stops: Stop[] = []
		for (let press = 0; press < 30; press += 1) {
			await page.keyboard.press('Tab')
			stops.push(await readActiveElement(page))
		}

		const empty = stops.filter((stop) => stop.width === 0 || stop.height === 0)
		expect(empty, `zero-size tab stops: ${JSON.stringify(empty)}`).toEqual([])
		expect(
			stops.some((stop) => stop.inHeader),
			'the shell header is reachable by keyboard',
		).toBe(true)
		expect(
			stops.some(
				(stop) => stop.tag === 'a' && /home|games|stats|leaderboard|profile/i.test(stop.name),
			),
			'the primary navigation is reachable by keyboard',
		).toBe(true)
	})

	test('keeps a visible focus indicator on the first shell controls', async ({ page }) => {
		await page.goto('/', { waitUntil: 'domcontentloaded' })
		await settle(page)

		const indicators: Array<{ name: string; visible: boolean }> = []
		for (let press = 0; press < 4; press += 1) {
			await page.keyboard.press('Tab')
			indicators.push(
				await page.evaluate(() => {
					const element = document.activeElement
					if (!element) return { name: '', visible: false }
					const style = getComputedStyle(element)
					const outline = style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 2
					const ring = style.boxShadow !== '' && style.boxShadow !== 'none'
					return {
						name: (element.getAttribute('aria-label') || element.textContent || '')
							.trim()
							.slice(0, 30),
						visible: outline || ring,
					}
				}),
			)
		}

		const withoutIndicator = indicators.filter((entry) => !entry.visible)
		expect(
			withoutIndicator,
			`stops without a focus indicator: ${JSON.stringify(withoutIndicator)}`,
		).toEqual([])
	})
})

test.describe('Overlay focus management', () => {
	test.use({ viewport: MOBILE })

	test('Escape closes the mobile nav sheet and restores focus to its trigger', async ({ page }) => {
		await page.goto('/', { waitUntil: 'domcontentloaded' })
		await settle(page)

		const trigger = page.getByRole('button', { name: /open menu/i })
		await trigger.click()

		const sheet = page.getByRole('dialog')
		await expect(sheet).toBeVisible()

		for (let press = 0; press < 6; press += 1) await page.keyboard.press('Tab')
		expect(
			await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]')),
			'focus stays inside the open sheet',
		).toBe(true)

		await page.keyboard.press('Escape')
		await expect(sheet).toBeHidden()
		await expect(trigger).toBeFocused()
	})

	test('Escape closes the game rules dialog and restores focus', async ({ page }) => {
		await page.setViewportSize(DESKTOP)
		await page.goto('/games/sudoku', { waitUntil: 'domcontentloaded' })
		await settle(page)

		const trigger = page.getByRole('button', { name: /how to play/i }).first()
		await trigger.click()

		const dialog = page.getByRole('dialog')
		await expect(dialog).toBeVisible()

		await page.keyboard.press('Escape')
		await expect(dialog).toBeHidden()
		await expect(trigger).toBeFocused()
	})

	test('Escape closes the language menu and restores focus to its trigger', async ({ page }) => {
		await page.setViewportSize(DESKTOP)
		await page.goto('/', { waitUntil: 'domcontentloaded' })
		await settle(page)

		const trigger = page.getByRole('button', { name: /change language/i }).first()
		await trigger.click()
		const menu = page.getByRole('menu')
		await expect(menu).toBeVisible()

		await page.keyboard.press('Escape')
		await expect(menu).toBeHidden()
		await expect(trigger).toBeFocused()
	})
})

test.describe('Company target size (44px effective hit area)', () => {
	for (const [name, viewport] of [
		['desktop', DESKTOP],
		['mobile', MOBILE],
	] as const) {
		test(`${name} shell controls`, async ({ page }) => {
			await page.setViewportSize(viewport)
			await page.goto('/', { waitUntil: 'domcontentloaded' })
			await settle(page)

			const offenders = await targetOffenders(page, SHELL_TARGET_SELECTOR)
			expect(
				offenders,
				`shell controls below 44px effective target:\n${offenders
					.map((entry) => `  ${entry.width}x${entry.height} ${entry.target} "${entry.name}"`)
					.join('\n')}`,
			).toEqual([])
		})
	}
})

test.describe('Reduced motion', () => {
	test.use({ viewport: DESKTOP, colorScheme: 'light', contextOptions: { reducedMotion: 'reduce' } })

	test('stops transform animation on shell surfaces', async ({ page }) => {
		await page.goto('/', { waitUntil: 'domcontentloaded' })
		await settle(page)
		await page.waitForTimeout(400)

		const running = await page.evaluate(() =>
			document
				.getAnimations()
				.filter((animation) => {
					const effect = animation.effect as KeyframeEffect | null
					if (!effect || typeof effect.getKeyframes !== 'function') return false
					return effect.getKeyframes().some((frame) => 'transform' in frame)
				})
				.map((animation) => animation.playState),
		)
		expect(running, 'transform animations running under reduced motion').toEqual([])
	})

	test('keeps the language menu popup static', async ({ page }) => {
		await page.goto('/', { waitUntil: 'domcontentloaded' })
		await settle(page)

		const trigger = page.getByRole('button', { name: /change language/i }).first()
		await trigger.click()
		const samples = await sampleTransform(page, '[role="menu"]')
		expect(
			new Set(samples).size,
			`popup transform changed: ${samples.join(' ')}`,
		).toBeLessThanOrEqual(1)
	})
})

test.describe('Motion for users without the preference', () => {
	test.use({
		viewport: DESKTOP,
		colorScheme: 'light',
		contextOptions: { reducedMotion: 'no-preference' },
	})

	test('keeps the language menu popup animation', async ({ page }) => {
		await page.goto('/', { waitUntil: 'domcontentloaded' })
		await settle(page)

		const trigger = page.getByRole('button', { name: /change language/i }).first()
		await trigger.click()
		const samples = await sampleTransform(page, '[role="menu"]')
		expect(
			new Set(samples).size,
			`expected the popup to animate, saw: ${samples.join(' ')}`,
		).toBeGreaterThan(1)
	})
})
