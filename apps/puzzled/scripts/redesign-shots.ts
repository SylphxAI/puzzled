import { chromium } from 'playwright'

const BASE = process.env.SHOT_BASE ?? 'http://127.0.0.1:3100'
const TAG = process.env.SHOT_TAG ?? 'after'
const OUT = process.env.SHOT_OUT ?? '/data/sylphx/home/work/pz-redesign-r1/notes/screenshots'

const targets = [
	{ name: 'desktop', width: 1440, height: 900 },
	{ name: 'mobile', width: 390, height: 844 },
] as const
const schemes = ['light', 'dark'] as const

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH })
for (const t of targets) {
	for (const scheme of schemes) {
		const ctx = await browser.newContext({
			viewport: { width: t.width, height: t.height },
			colorScheme: scheme,
			deviceScaleFactor: 1,
		})
		const page = await ctx.newPage()
		await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {})
		await page.waitForTimeout(2500)
		await page.screenshot({ path: `${OUT}/${TAG}-${t.name}-${scheme}.png` })
		await ctx.close()
	}
}
await browser.close()
console.log('shots done', TAG)
