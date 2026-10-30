import { expect, test } from '@playwright/test'

test.use({
	viewport: { width: 390, height: 844 },
	bypassCSP: process.env.PUZZLED_TEST_DEV_CSP === '1',
})

const solution = Array.from({ length: 9 }, (_, r) =>
	Array.from({ length: 9 }, (_, c) => ((r * 3 + Math.floor(r / 3) + c) % 9) + 1),
)

test('a saved result image never claims its caption copied after a clipboard denial', async ({
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
					grid: solution.map((row, r) => row.map((n, c) => (r === 8 && c === 8 ? null : n))),
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
	await page
		.getByRole('group', { name: 'Sudoku', exact: true })
		.getByRole('button', { name: 'Row 9, Column 9', exact: true })
		.click()
	await page.keyboard.press('8')
	const dialog = page.getByRole('dialog')
	await expect(dialog).toBeVisible()
	const cdp = await page.context().newCDPSession(page)
	const origin = new URL(page.url()).origin
	const { targetInfo } = await cdp.send('Target.getTargetInfo')
	const browserContextId = targetInfo.browserContextId
	await cdp.send('Browser.setPermission', {
		permission: { name: 'clipboard-write' },
		setting: 'denied',
		origin,
		browserContextId,
	})
	expect(
		await page.evaluate(
			async () =>
				(await navigator.permissions.query({ name: 'clipboard-write' as PermissionName })).state,
		),
	).toBe('denied')
	const download = page.waitForEvent('download')
	await dialog.getByRole('button', { name: 'Share', exact: true }).click()
	await download
	await expect(dialog.getByText('Card image saved.', { exact: true })).toBeVisible()
	await expect(dialog.getByText(/caption copied to the clipboard/i)).toHaveCount(0)
	await expect(dialog.getByRole('alert')).toHaveText(
		'Could not copy. The text is selected; copy it manually or try again.',
	)
	const caption = dialog.getByRole('textbox', { name: 'Result caption' })
	const value = await caption.inputValue()
	expect(value).toContain('/games/sudoku')
	expect(
		await caption.evaluate((el: HTMLTextAreaElement) => el.selectionEnd - el.selectionStart),
	).toBe(value.length)
	await dialog.getByRole('button', { name: 'Copy', exact: true }).click()
	await expect(dialog.getByRole('alert')).toBeVisible()
	await cdp.send('Browser.setPermission', {
		permission: { name: 'clipboard-write' },
		setting: 'granted',
		origin,
		browserContextId,
	})
	await dialog.getByRole('button', { name: 'Copy', exact: true }).click()
	await expect(
		dialog.getByRole('button', { name: 'Copied to clipboard!', exact: true }),
	).toBeVisible()
	await expect(dialog.getByRole('alert')).toHaveCount(0)
})
