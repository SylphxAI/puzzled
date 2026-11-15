import { expect, type Locator, type Page, test } from '@playwright/test'

// Run against a locally served production build with serve-puzzle-fixture.ts.
// Every browser mutation is intercepted; this suite never submits a live finish.
test.beforeEach(async ({ page, baseURL }) => {
	const host = new URL(baseURL || 'http://localhost:3000').hostname
	if (!['localhost', '127.0.0.1'].includes(host))
		throw new Error('Board craft requires a local fixture')
	await page.route('**/v1/guest/session', (route) => route.fulfill({ json: { issued: true } }))
	await page.route('**/puzzled.v1.PuzzleService/SubmitGuess', (route) =>
		route.fulfill({ json: { valid: false, error: 'Craft fixture: no finish accepted' } }),
	)
})

async function start(page: Page, locale = 'en-US') {
	await page.goto(`/${locale}/games/sudoku?difficulty=easy`)
	const decline = page.getByRole('button', { name: /^(Decline|拒絕)$/ })
	if (await decline.isVisible()) await decline.click()
	await page.getByRole('button', { name: /^(Start game|開始遊戲)$/i }).click()
	const board = page.locator('[role="group"]').filter({ has: page.locator('button[data-given]') })
	await expect(board).toBeVisible()
	await expect(board.locator('button')).toHaveCount(81)
	return board
}

async function dimensions(controls: Locator) {
	for (const control of await controls.all()) {
		const box = await control.boundingBox()
		expect(box).not.toBeNull()
		expect(box!.width).toBeGreaterThanOrEqual(48)
		expect(box!.height).toBeGreaterThanOrEqual(48)
	}
}

for (const [width, height] of [
	[1440, 900],
	[768, 1024],
	[390, 844],
	[375, 667],
]) {
	test(`board and controls at ${width}x${height}`, async ({ page }, testInfo) => {
		await page.setViewportSize({ width, height })
		const board = await start(page)
		const blank = board.locator('button:not([data-given])').first()
		await blank.click()
		await expect(blank).toHaveAttribute('data-selected', 'true')
		await expect(board.locator('[data-related]')).not.toHaveCount(0)
		await page.keyboard.press('n')
		await page.getByRole('button', { name: '3', exact: true }).click()
		await expect(blank.locator('[data-visible]')).toHaveText('3')
		await page.keyboard.press('Control+z')
		await expect(blank.locator('[data-visible]')).toHaveCount(0)
		await page.keyboard.press('n')
		await page.keyboard.press('4')
		await expect(blank).toHaveAttribute('data-filled', 'true')
		await expect(blank.locator('span').first()).toHaveCSS('text-decoration-line', 'underline')
		await page.getByRole('button', { name: 'Undo', exact: true }).click()
		await expect(blank).not.toHaveAttribute('data-filled')
		await blank.click()
		await page.keyboard.press('ArrowRight')
		await expect(board.locator('[data-selected]')).toHaveCount(1)
		await blank.click()
		const row = (await blank.getAttribute('aria-label'))!.match(/Row (\d+)/)![1]
		const given = board.locator('button[data-given]').filter({ hasText: /[1-9]/ })
		const rowGiven = given
			.and(board.getByRole('button', { name: new RegExp(`^Row ${row},`) }))
			.first()
		const value = (await rowGiven.getAttribute('aria-label'))!.match(/, ([1-9])$/)![1]
		await page.keyboard.press(value)
		await expect(blank).toHaveAttribute('data-conflict', 'true')
		await expect(blank.locator('[aria-hidden="true"]')).toHaveText('!')
		await expect(board.locator('[data-matching]')).not.toHaveCount(0)
		await page.keyboard.press('Delete')
		await expect(blank).not.toHaveAttribute('data-filled')
		await page.keyboard.press('n')
		await page.keyboard.press('2')
		await page.keyboard.press('7')
		const pad = page.getByRole('button', { name: 'Clear', exact: true }).locator('..').locator('..')
		await dimensions(pad.getByRole('button'))
		await expect
			.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
			.toBe(true)
		await page.getByRole('button', { name: 'Notes Mode', exact: true }).scrollIntoViewIfNeeded()
		await page.screenshot({
			path: testInfo.outputPath(`board-${width}x${height}.png`),
			fullPage: false,
		})
	})
}

test('dark CJK controls retain geometry and reduced-motion focus', async ({ page }, testInfo) => {
	await page.setViewportSize({ width: 390, height: 844 })
	await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
	const board = await start(page, 'zh-HK')
	const blank = board.locator('button:not([data-given])').first()
	await blank.click()
	await page.keyboard.press('n')
	await page.keyboard.press('2')
	await page.keyboard.press('Tab')
	await expect(page.locator(':focus-visible')).toHaveCSS('outline-width', '3px')
	// Global reduced-motion policy uses 0.01ms rather than an exact zero.
	await expect
		.poll(() =>
			blank.evaluate((cell) => {
				const durations = getComputedStyle(cell).transitionDuration.split(',')
				return Math.max(
					...durations.map((duration) => {
						const unit = duration.trim().endsWith('ms') ? 1 : 1000
						return Number.parseFloat(duration) * unit
					}),
				)
			}),
		)
		.toBeLessThanOrEqual(0.01)
	const notes = page.getByRole('button', { name: '筆記模式', exact: true })
	await dimensions(notes)
	await notes.scrollIntoViewIfNeeded()
	await page.screenshot({ path: testInfo.outputPath('board-dark-zh-HK.png'), fullPage: false })
})
