import { chromium } from 'playwright'

const BASE = process.env.SHOT_BASE ?? 'http://localhost:3100'
const browser = await chromium.launch()
const ctx = await browser.newContext({
	viewport: { width: 1440, height: 900 },
	colorScheme: 'light',
})
const page = await ctx.newPage()
await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' }).catch(() => {})
await page.waitForTimeout(2000)
const r = await page.evaluate(() => {
	const el = document.querySelector('.gap-3 > .truncate')
	const btn = el ? el.closest('button') : null
	return {
		btnBg: btn ? getComputedStyle(btn).backgroundColor : 'none',
		btnColor: btn ? getComputedStyle(btn).color : 'none',
		footerBg: (() => {
			const f = document.querySelector('footer')
			return f ? getComputedStyle(f).backgroundColor : 'none'
		})(),
	}
})
console.log(JSON.stringify(r))
await browser.close()
