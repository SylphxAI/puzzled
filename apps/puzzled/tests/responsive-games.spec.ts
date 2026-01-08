import { test, expect } from '@playwright/test';

/**
 * Responsive UI testing for puzzle games
 * Tests all 10 games at mobile, tablet, and desktop viewports
 */

const GAMES = [
	{ slug: 'wordle', name: 'Wordle' },
	{ slug: 'connections', name: 'Connections' },
	{ slug: 'spelling-bee', name: 'Spelling Bee' },
	{ slug: 'crossword', name: 'Crossword' },
	{ slug: 'sudoku', name: 'Sudoku' },
	{ slug: 'nonogram', name: 'Nonogram' },
	{ slug: 'word-ladder', name: 'Word Ladder' },
	{ slug: 'arithmo', name: 'Arithmo' },
	{ slug: 'pattern-match', name: 'Pattern Match' },
	{ slug: 'block-slide', name: 'Block Slide' },
];

const VIEWPORTS = [
	{ name: 'mobile', width: 375, height: 667 }, // iPhone SE
	{ name: 'tablet', width: 768, height: 1024 }, // iPad
	{ name: 'desktop', width: 1280, height: 720 }, // Desktop
];

test.describe('Responsive UI Tests for All Games', () => {
	for (const game of GAMES) {
		test.describe(game.name, () => {
			for (const viewport of VIEWPORTS) {
				test(`should render properly on ${viewport.name} (${viewport.width}x${viewport.height})`, async ({
					page,
				}) => {
					// Set viewport size
					await page.setViewportSize({
						width: viewport.width,
						height: viewport.height,
					});

					// Navigate to game page
					await page.goto(`/en/games/${game.slug}`);

					// Wait for game to load (look for main content or game container)
					await page.waitForSelector('main', { timeout: 10000 });

					// Give the page a moment to fully render
					await page.waitForTimeout(1000);

					// Check for horizontal overflow
					const hasHorizontalOverflow = await page.evaluate(() => {
						const bodyScrollWidth = document.body.scrollWidth;
						const windowInnerWidth = window.innerWidth;
						return bodyScrollWidth > windowInnerWidth;
					});

					// Take a screenshot for visual inspection
					await page.screenshot({
						path: `test-results/screenshots/${game.slug}-${viewport.name}.png`,
						fullPage: true,
					});

					// Assert no horizontal overflow
					expect(
						hasHorizontalOverflow,
						`${game.name} should not have horizontal overflow on ${viewport.name}`,
					).toBe(false);

					// Additional check: ensure viewport meta tag is set correctly
					const viewportMetaContent = await page.getAttribute(
						'meta[name="viewport"]',
						'content',
					);
					expect(viewportMetaContent).toContain('width=device-width');

					// Check that main content is visible
					const mainElement = await page.locator('main');
					await expect(mainElement).toBeVisible();

					// Log viewport dimensions and scroll dimensions for debugging
					const dimensions = await page.evaluate(() => ({
						windowWidth: window.innerWidth,
						windowHeight: window.innerHeight,
						bodyScrollWidth: document.body.scrollWidth,
						bodyScrollHeight: document.body.scrollHeight,
						documentScrollWidth: document.documentElement.scrollWidth,
					}));

					console.log(
						`${game.name} on ${viewport.name}: windowWidth=${dimensions.windowWidth}, bodyScrollWidth=${dimensions.bodyScrollWidth}, documentScrollWidth=${dimensions.documentScrollWidth}`,
					);
				});
			}

			// Additional test: Check all viewports in one test for quick overview
			test('should have no horizontal overflow on any viewport', async ({
				page,
			}) => {
				const results: {
					viewport: string;
					hasOverflow: boolean;
					scrollWidth: number;
					innerWidth: number;
				}[] = [];

				for (const viewport of VIEWPORTS) {
					await page.setViewportSize({
						width: viewport.width,
						height: viewport.height,
					});
					await page.goto(`/en/games/${game.slug}`);
					await page.waitForSelector('main', { timeout: 10000 });
					await page.waitForTimeout(500);

					const hasOverflow = await page.evaluate(() => {
						return document.body.scrollWidth > window.innerWidth;
					});

					const dimensions = await page.evaluate(() => ({
						scrollWidth: document.body.scrollWidth,
						innerWidth: window.innerWidth,
					}));

					results.push({
						viewport: viewport.name,
						hasOverflow,
						scrollWidth: dimensions.scrollWidth,
						innerWidth: dimensions.innerWidth,
					});
				}

				// Log all results
				console.log(`${game.name} overflow check:`, results);

				// Assert none have overflow
				const overflowingViewports = results.filter((r) => r.hasOverflow);
				expect(
					overflowingViewports,
					`${game.name} should have no horizontal overflow on any viewport`,
				).toEqual([]);
			});
		});
	}

	// Summary test: Quick check of all games on mobile
	test('all games should work on mobile viewport', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 667 });

		const failedGames: string[] = [];

		for (const game of GAMES) {
			try {
				await page.goto(`/en/games/${game.slug}`, { timeout: 10000 });
				await page.waitForSelector('main', { timeout: 5000 });

				const hasOverflow = await page.evaluate(() => {
					return document.body.scrollWidth > window.innerWidth;
				});

				if (hasOverflow) {
					failedGames.push(game.name);
				}
			} catch (error) {
				failedGames.push(`${game.name} (error: ${error})`);
			}
		}

		expect(
			failedGames,
			'All games should render without overflow on mobile',
		).toEqual([]);
	});
});
