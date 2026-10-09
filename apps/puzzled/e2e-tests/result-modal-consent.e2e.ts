import { expect, test } from '@playwright/test'

/**
 * A first-visit guest finishes today's game without answering the cookie
 * banner. The banner must not sit on the result modal's actions (WCAG 2.2
 * SC 2.4.11), and its own buttons must still respond.
 */
test.use({
	viewport: { width: 390, height: 844 },
	bypassCSP: process.env.PUZZLED_TEST_DEV_CSP === '1',
})

const solution = Array.from({ length: 9 }, (_, r) =>
	Array.from({ length: 9 }, (_, c) => ((r * 3 + Math.floor(r / 3) + c) % 9) + 1),
)

test('result modal actions are tappable and the banner can be declined with the banner unanswered', async ({
	page,
}) => {
	await page.route('**/puzzled.v1.PuzzleService/GetDaily', (route) =>
		route.fulfill({
			json: {
				gameSlug: 'sudoku',
				difficulty: 'easy',
				canPlay: true,
				mode: 'daily',
				puzzleDataJson: JSON.stringify({
					grid: solution.map((row, r) => row.map((v, c) => (r === 8 && c === 8 ? null : v))),
					difficulty: 'easy',
				}),
			},
		}),
	)
	await page.route('**/puzzled.v1.PuzzleService/SubmitGuess', (route) =>
		route.fulfill({ json: { valid: true, status: 'won', score: 900, gameSlug: 'sudoku' } }),
	)
	await page.goto('/en-US/games/sudoku?difficulty=easy')
	await page.getByRole('button', { name: /start game/i }).click({ timeout: 60_000 })
	const board = page.getByRole('group', { name: 'Sudoku', exact: true })
	await board.getByRole('button', { name: 'Row 9, Column 9', exact: true }).click()
	await page.keyboard.press(String(solution[8][8]))
	const dialog = page.getByRole('dialog')
	await expect(dialog).toBeVisible()
	await expect(page.locator('button', { hasText: /^Decline$/ })).toHaveCount(1)

	// Every action in the modal must be the element under its own centre.
	const targets = dialog.locator('a, button').filter({ visible: true })
	const count = await targets.count()
	expect(count).toBeGreaterThan(0)
	for (let i = 0; i < count; i++) {
		const target = targets.nth(i)
		await target.scrollIntoViewIfNeeded()
		const hit = await target.evaluate((el) => {
			const r = el.getBoundingClientRect()
			const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
			return !!top && el.contains(top)
		})
		expect(hit, `action ${i} is covered`).toBe(true)
	}

	// The Plus offer, when the store is open, leads to pricing.
	const plus = dialog.getByRole('link', { name: 'See Puzzled Plus' })
	if (await plus.count()) {
		await plus.click()
		await expect(page).toHaveURL(/\/pricing/)
	} else {
		await page.keyboard.press('Escape')
	}
	await expect(dialog).toHaveCount(0)
	await page.locator('button', { hasText: /^Decline$/ }).click()
	await expect(page.locator('button', { hasText: /^Decline$/ })).toHaveCount(0)
})
