import { chromium } from 'playwright'

const BASE = process.env.SHOT_BASE ?? 'http://127.0.0.1:3100'
const TAG = process.env.SHOT_TAG ?? 'after'
const OUT =
	process.env.SHOT_OUT ??
	'/data/sylphx/home/workspace/.worktrees/github.com/SylphxAI/puzzled/s3-richness/notes/screenshots'

const targets = [
	{ name: 'desktop', width: 1440, height: 900 },
	{ name: 'mobile', width: 390, height: 844 },
] as const
const schemes = ['light', 'dark'] as const
// Home (full skin) + /games (every card's own hue — the S3 richness).
const pages = [
	{ suffix: '', path: '/' },
	{ suffix: '-games', path: '/games' },
] as const

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH })
for (const t of targets) {
	for (const scheme of schemes) {
		const ctx = await browser.newContext({
			viewport: { width: t.width, height: t.height },
			colorScheme: scheme,
			deviceScaleFactor: 1,
		})
		const page = await ctx.newPage()
		for (const p of pages) {
			await page
				.goto(BASE + p.path, { waitUntil: 'domcontentloaded', timeout: 45000 })
				.catch(() => {})
			await page.waitForLoadState('networkidle').catch(() => {})
			await page.waitForTimeout(1500)
			// Trigger lazy content before the full-page capture, then return to the top.
			await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
			await page.waitForTimeout(1000)
			await page.evaluate(() => window.scrollTo(0, 0))
			await page.waitForTimeout(800)
			await page.screenshot({
				path: `${OUT}/${TAG}-${t.name}-${scheme}${p.suffix}.png`,
				fullPage: true,
			})
		}
		await ctx.close()
	}
}
await browser.close()
console.log('shots done', TAG)
