/**
 * Hover-check for the game-tile glow (S3 richness slice).
 *
 * Asserts that hovering a /games tile paints the module in its OWN hue:
 *  - the glow shadow (0 8px 24px -6px rgba(<hue>,0.45)), and
 *  - the 2px ring (--tw-ring-shadow, a shadow-mechanism ring — see note below).
 *
 * Note: the ring deliberately replaces a hover border. The app's globals.css
 * carries an UNLAYERED `* { border-color: var(--color-border) }` rule; unlayered
 * CSS beats every layered Tailwind utility (cascade layers), so any
 * `border-*` / `hover:border-*` colour utility is silently dead app-wide.
 * Rings ride the box-shadow chain and are unaffected. Root-cause fix for the
 * `*` rule (move it into @layer base) is a separate, app-wide change.
 *
 * Run against a local dev server:
 *   SHOT_BASE=http://localhost:3459 bun apps/puzzled/scripts/s3-hover-probe.ts
 */
import { chromium } from 'playwright'

const BASE = process.env.SHOT_BASE ?? 'http://127.0.0.1:3459'
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH })
const ctx = await browser.newContext({
	viewport: { width: 1440, height: 900 },
	colorScheme: 'light',
})
const page = await ctx.newPage()
await page.goto(`${BASE}/games`, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {})
await page.waitForTimeout(2500)
const tile = page.locator('div.group.animate-enter').first()
await tile.scrollIntoViewIfNeeded()
await tile.hover()
await page.waitForTimeout(700)
const report = await tile.evaluate((el) => ({
	hovered: el.matches(':hover'),
	boxShadow: getComputedStyle(el).boxShadow,
}))
const shadow = report.boxShadow
const hasGlowShadow = /8px 24px -6px/.test(shadow) && /0\.45/.test(shadow)
const hasRing = /0px 0px 0px 2px/.test(shadow)
const ok = report.hovered && hasGlowShadow && hasRing
console.log(JSON.stringify({ ...report, hasGlowShadow, hasRing, ok }, null, 1))
await browser.close()
if (!ok) process.exit(1)
