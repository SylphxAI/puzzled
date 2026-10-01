import { expect, test } from '@playwright/test'
import { GUEST_GAMES_KEY } from '../src/lib/storage-keys'

// The dev transport uses :3001 while production is same-origin. Only local
// intercepted-RPC runs opt out of CSP; the served production CI build does not.
const localDevCsp = process.env.PUZZLED_TEST_DEV_CSP === '1'
if (
	localDevCsp &&
	(process.env.GITHUB_ACTIONS === 'true' ||
		!['localhost', '127.0.0.1'].includes(
			new URL(process.env.BASE_URL || 'http://localhost:3000').hostname,
		))
) {
	throw new Error(
		'Dev CSP opt-out is only allowed for local intercepted-RPC tests, never CI or live',
	)
}
test.use({ bypassCSP: localDevCsp })

/** A complete Sudoku used only to serve a deterministic browser-test board. */
const solution = Array.from({ length: 9 }, (_, r) =>
	Array.from({ length: 9 }, (_, c) => ((r * 3 + Math.floor(r / 3) + c) % 9) + 1),
)

// This also solves an SSR-served board when the local API is available.
function solve(grid: number[][]): boolean {
	for (let r = 0; r < 9; r++) {
		for (let c = 0; c < 9; c++) {
			if (grid[r][c]) continue
			for (let value = 1; value <= 9; value++) {
				if (grid[r].includes(value) || grid.some((row) => row[c] === value)) continue
				const boxR = Math.floor(r / 3) * 3
				const boxC = Math.floor(c / 3) * 3
				if (grid.slice(boxR, boxR + 3).some((row) => row.slice(boxC, boxC + 3).includes(value)))
					continue
				grid[r][c] = value
				if (solve(grid)) return true
				grid[r][c] = 0
			}
			return false
		}
	}
	return true
}

test('Sudoku waits for acceptance, shows rejection, and retries without false guest completion', async ({
	page,
}) => {
	await page.route('**/puzzled.v1.PuzzleService/GetDaily', async (route) => {
		await route.fulfill({
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
		})
	})
	let submissions = 0
	let release: (() => void) | undefined
	const pending = new Promise<void>((resolve) => {
		release = resolve
	})
	await page.route('**/puzzled.v1.PuzzleService/SubmitGuess', async (route) => {
		submissions++
		if (submissions === 1) {
			await pending
			await route.fulfill({
				json: { valid: false, error: 'Sudoku test authority rejected this finish' },
			})
		} else {
			await route.fulfill({ json: { valid: true, status: 'won', score: 900, gameSlug: 'sudoku' } })
		}
	})
	await page.goto('/en-US/games/sudoku?difficulty=easy')
	const start = page.getByRole('button', { name: /start game/i })
	await expect(start).toBeVisible({ timeout: 60_000 })
	await start.click()
	const board = page.getByRole('group', { name: 'Sudoku', exact: true })
	await expect(board).toBeVisible()
	const grid = Array.from({ length: 9 }, () => Array<number>(9).fill(0))
	const blanks: [number, number][] = []
	for (let r = 0; r < 9; r++) {
		for (let c = 0; c < 9; c++) {
			const cell = board.getByRole('button', {
				name: new RegExp(`^Row ${r + 1}, Column ${c + 1}(,|$)`),
			})
			const label = await cell.getAttribute('aria-label')
			const value = label?.match(/, ([1-9])$/)?.[1]
			if (value) grid[r][c] = Number(value)
			else blanks.push([r, c])
		}
	}
	expect(blanks.length).toBeGreaterThan(0)
	expect(solve(grid)).toBe(true)
	for (const [r, c] of blanks) {
		await board.getByRole('button', { name: `Row ${r + 1}, Column ${c + 1}`, exact: true }).click()
		await page.keyboard.press(String(grid[r][c]))
	}
	await expect.poll(() => submissions).toBe(1)
	await expect(page.getByText('Congratulations!', { exact: true })).toHaveCount(0)
	const markers = () =>
		page.evaluate(
			({ games }) => ({
				games: JSON.parse(localStorage.getItem(games) || '{"games":[]}').games,
			}),
			{ games: GUEST_GAMES_KEY },
		)
	const before = await markers()
	expect(before.games).toEqual([])
	release?.()
	await expect(page.locator('main [role="alert"]')).toHaveText(
		/Sudoku test authority rejected this finish/,
	)
	await expect(page.getByText('Congratulations!', { exact: true })).toHaveCount(0)
	expect(await markers()).toEqual(before)
	await expect(board).toBeVisible()
	await page.getByRole('button', { name: 'Try again', exact: true }).click()
	await expect(page.getByText('Congratulations!', { exact: true })).toBeVisible()
	expect(submissions).toBe(2)
	await expect.poll(async () => (await markers()).games.length).toBe(1)
})

for (const slug of ['nonogram', 'crowns'] as const) {
	test(`${slug} rejection keeps the board and retries without congratulations or guest completion`, async ({
		page,
	}) => {
		const puzzle =
			slug === 'nonogram'
				? { width: 1, height: 1, rowClues: [[1]], colClues: [[1]] }
				: { size: 4, regions: Array.from({ length: 4 }, (_, r) => Array<number>(4).fill(r)) }
		await page.route('**/puzzled.v1.PuzzleService/GetDaily', (route) =>
			route.fulfill({
				json: {
					gameSlug: slug,
					difficulty: 'easy',
					canPlay: true,
					mode: 'daily',
					puzzleDataJson: JSON.stringify(puzzle),
				},
			}),
		)
		let submissions = 0
		await page.route('**/puzzled.v1.PuzzleService/SubmitGuess', (route) => {
			submissions++
			return route.fulfill({
				json:
					submissions === 1
						? { valid: false, error: `${slug} test authority rejected this finish` }
						: { valid: true, status: 'won', score: 900, gameSlug: slug },
			})
		})
		await page.goto(`/games/${slug}?difficulty=easy`)
		await page
			.getByRole('button', {
				name: slug === 'nonogram' ? /start game/i : 'Play',
				exact: slug === 'crowns',
			})
			.click()
		const cells =
			slug === 'nonogram'
				? page
						.locator('button')
						.filter({ hasText: /^$/ })
						.filter({ visible: true })
						.and(page.locator('button.w-6'))
				: page.locator('div.grid[style*="repeat(4"] > button')
		await expect(cells).toHaveCount(slug === 'nonogram' ? 1 : 16)
		if (slug === 'nonogram') await cells.first().click()
		else for (const index of [1, 7, 8, 14]) await cells.nth(index).click()
		await expect(page.locator('main [role="alert"]')).toContainText(
			`${slug} test authority rejected this finish`,
		)
		await expect(page.getByText('Congratulations!', { exact: true })).toHaveCount(0)
		expect(
			await page.evaluate(
				(key) => JSON.parse(localStorage.getItem(key) || '{"games":[]}').games,
				GUEST_GAMES_KEY,
			),
		).toEqual([])
		await expect(cells.first()).toBeVisible()
		await page.getByRole('button', { name: 'Try again', exact: true }).click()
		await expect(page.getByText('Congratulations!', { exact: true })).toBeVisible()
		expect(submissions).toBe(2)
	})
}
