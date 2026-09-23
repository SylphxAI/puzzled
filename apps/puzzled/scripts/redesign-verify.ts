import { chromium } from 'playwright'

const BASE = process.env.SHOT_BASE ?? 'http://127.0.0.1:3100'
const browser = await chromium.launch()
for (const scheme of ['light', 'dark'] as const) {
	const ctx = await browser.newContext({
		viewport: { width: 1440, height: 900 },
		colorScheme: scheme,
	})
	const page = await ctx.newPage()
	await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {})
	await page.waitForTimeout(2000)
	const report = await page.evaluate(() => {
		const body = getComputedStyle(document.body)
		const pricingLinks = document.querySelectorAll('a[href="/pricing"]').length
		const h1 = document.querySelector('h1')
		const h1Font = h1 ? getComputedStyle(h1).fontFamily : 'none'
		const doc = document.documentElement.className
		return {
			bg: body.backgroundColor,
			fg: body.color,
			pricingLinks,
			h1Font,
			docClass: doc.slice(0, 60),
		}
	})
	console.log(scheme, JSON.stringify(report))
	await ctx.close()
}
await browser.close()
