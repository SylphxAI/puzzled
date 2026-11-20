import { expect, type Locator, type Page, test } from '@playwright/test'
import { settle } from './a11y-support'

/** Pricing choices, benefits and guest return paths stay available at every size. */
const VIEWPORTS = [
	{ name: 'laptop-1440x757', width: 1440, height: 757 },
	{ name: 'desktop-1440x900', width: 1440, height: 900 },
	{ name: 'tablet-768x1024', width: 768, height: 1024 },
	{ name: 'mobile-390x844', width: 390, height: 844 },
	{ name: 'small-375x667', width: 375, height: 667 },
]

async function openPricing(page: Page) {
	await page.goto('/pricing', { waitUntil: 'domcontentloaded' })
	await settle(page)
}

/** Check the painted hit target, including rounded CTA corners, without navigating. */
async function expectReachable(target: Locator) {
	await target.evaluate((el) => el.scrollIntoView({ block: 'center' }))
	await expect(target).toBeInViewport({ ratio: 1 })
	expect(
		await target.evaluate((el) => {
			const r = el.getBoundingClientRect()
			return [
				[r.x + 8, r.y + 8],
				[r.right - 8, r.y + 8],
				[r.x + 8, r.bottom - 8],
				[r.right - 8, r.bottom - 8],
			].every(([x, y]) => el.contains(document.elementFromPoint(x, y)))
		}),
	).toBe(true)
	await target.click({ trial: true })
}

for (const viewport of VIEWPORTS) {
	test.describe(`Pricing first screen (${viewport.name})`, () => {
		test.use({ viewport: { width: viewport.width, height: viewport.height } })

		for (const consentState of ['open', 'dismissed'] as const) {
			test(`viewport evidence with consent ${consentState}`, async ({ page }, testInfo) => {
				await openPricing(page)
				const decline = page.getByRole('button', { name: 'Decline', exact: true })
				await expect(decline).toBeVisible()
				if (consentState === 'dismissed') await decline.click()
				await page.evaluate(() => window.scrollTo(0, 0))
				await testInfo.attach(`pricing-${viewport.name}-${consentState}-initial`, {
					body: await page.screenshot({
						fullPage: false,
						path: testInfo.outputPath(`pricing-${viewport.name}-${consentState}-initial.png`),
					}),
					contentType: 'image/png',
				})
				expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
					viewport.width,
				)
				if (viewport.width === 1440 || viewport.width === 390) {
					// Before dismissing the cookie banner or scrolling, the flagship CTA
					// must be 100% unobstructed and never overlap the cookie banner.
					const plusCta = page.locator('#plus').getByRole('button', { name: 'Continue to payment' })
					await expect(plusCta).toBeEnabled()
					const unobstructed = await plusCta.evaluate((el) => {
						const r = el.getBoundingClientRect()
						const banner = document.querySelector('[data-consent-banner] > section')
						const b = banner?.getBoundingClientRect()
						const overlapsBanner =
							!!b &&
							b.width > 0 &&
							b.height > 0 &&
							r.left < b.right &&
							r.right > b.left &&
							r.top < b.bottom &&
							r.bottom > b.top
						const hitAllCorners = [
							[r.x + 8, r.y + 8],
							[r.right - 8, r.y + 8],
							[r.x + 8, r.bottom - 8],
							[r.right - 8, r.bottom - 8],
							[r.x + r.width / 2, r.y + r.height / 2],
						].every(([x, y]) => el.contains(document.elementFromPoint(x, y)))
						return { overlapsBanner, hitAllCorners }
					})
					expect(unobstructed.overlapsBanner).toBe(false)
					expect(unobstructed.hitAllCorners).toBe(true)
					if (viewport.width === 1440) {
						// Flagship Continue to payment sits cleanly inside the initial laptop & desktop fold.
						const bottom = await plusCta.evaluate((el) => el.getBoundingClientRect().bottom)
						expect(bottom).toBeLessThanOrEqual(viewport.height)
					}
				}
				for (const id of ['plus', 'family']) {
					const offer = page.locator(`#${id}`)
					await expect(offer.getByText('All 19 games, every day', { exact: true })).toBeVisible()
					await expect(
						offer.getByText('Every past day in the archive', { exact: true }),
					).toBeVisible()
					await expect(
						offer.getByText('Stats and streaks for every game', { exact: true }),
					).toBeVisible()
					// Recurring subscriptions (Yearly default) never render the Reg 37 14-day waiver checkbox.
					await expect(offer.getByRole('checkbox')).toHaveCount(0)
					const cta = offer.getByRole('button', { name: 'Continue to payment' })
					await expect(cta).toBeEnabled()
					await cta.evaluate((el) => el.scrollIntoView({ block: 'center' }))
					await expect(cta).toBeInViewport({ ratio: 1 })
					await testInfo.attach(`pricing-${viewport.name}-${consentState}-${id}-scrolled`, {
						body: await page.screenshot({
							fullPage: false,
							path: testInfo.outputPath(
								`pricing-${viewport.name}-${consentState}-${id}-scrolled.png`,
							),
						}),
						contentType: 'image/png',
					})
					await expectReachable(cta)
				}
				// Selecting the one-off 3-Day Pass renders and requires the Reg 37 14-day waiver checkbox.
				const plus = page.locator('#plus')
				const passRadio = plus.locator('input[value="once"]')
				if ((await passRadio.count()) > 0) {
					await passRadio.check()
					const waiver = plus.getByRole('checkbox')
					await expect(waiver).toHaveCount(1)
					await expect(waiver).not.toBeChecked()
					const passCta = plus.getByRole('button', { name: 'Continue to payment' })
					await expect(passCta).toBeDisabled()
					await waiver.check()
					await expect(passCta).toBeEnabled()
					await expectReachable(passCta)
					await plus.locator('input[value="year"]').check()
					await expect(plus.getByRole('checkbox')).toHaveCount(0)
				}
				// Pricing is a page, with a free-play escape link rather than a modal close button.
				const freePlay = page.getByRole('link', {
					name: "Not now, play today's free puzzle",
					exact: true,
				})
				await expect(freePlay).toHaveAttribute('href', /^\/games\/[^/?#]+$/)
				await expectReachable(freePlay)
				for (const path of ['/privacy', '/terms']) {
					const legal = page.locator(`footer a[href="${path}"]`)
					await expect(legal).toHaveCount(1)
					await expectReachable(legal)
				}
				if (consentState === 'open') await expect(decline).toBeVisible()
				else await expect(decline).toHaveCount(0)
			})
		}

		test('leads with Plus: Yearly preselected and checkout reachable', async ({
			page,
		}, testInfo) => {
			await openPricing(page)
			// Single clean render: one #plus card, one #family card, zero Loading...
			await expect(page.locator('#plus')).toHaveCount(1)
			await expect(page.locator('#family')).toHaveCount(1)
			await expect(page.getByText('Loading...')).toHaveCount(0)
			const offer = page.locator('#plus')
			const yearly = offer.getByRole('radio', { name: /^Yearly/ })
			test.skip((await yearly.count()) === 0, 'sales are closed: no plans to lead with')

			await expect(yearly).toBeChecked()
			await expect(offer.getByRole('radio', { name: /^Monthly/ })).not.toBeChecked()

			// Cold guests and signed-in non-members get compliant Reg 36 terms + enabled payment CTA on recurring plans.
			await expect(offer.getByRole('checkbox')).toHaveCount(0)
			const payment = offer.getByRole('button', { name: 'Continue to payment' })
			await payment.scrollIntoViewIfNeeded()
			await expect(payment).toBeInViewport({ ratio: 1 })
			await expect(payment).toBeEnabled()

			await testInfo.attach(`pricing-${viewport.name}`, {
				body: await page.screenshot(),
				contentType: 'image/png',
			})
		})

		test('keeps free play as one text link and puts the Free card after it', async ({ page }) => {
			await openPricing(page)
			const offer = page.locator('#plus')
			test.skip((await offer.getByRole('radio').count()) === 0, 'sales are closed')

			const freePlay = page.getByRole('link', { name: "Not now, play today's free puzzle" })
			await expect(freePlay).toHaveCount(1)
			await freePlay.evaluate((el) => el.scrollIntoView({ block: 'center' }))
			await expect(freePlay).toBeInViewport({ ratio: 1 })
			await expect(
				page.getByRole('link', { name: /^Family plan for up to \d+ players$/ }),
			).toBeVisible()
			// The only other free-play control would be a duplicate button.
			await expect(page.getByRole('link', { name: /^Play today's free puzzle/ })).toHaveCount(0)

			const freeCard = page.getByRole('heading', { name: 'Free', exact: true })
			await expect(freeCard).toBeVisible()
			const freeTop = (await freeCard.boundingBox())?.y ?? 0
			const linkBottom = await freePlay.evaluate((el) => el.getBoundingClientRect().bottom)
			expect(freeTop, 'the Free card sits below the free-play link').toBeGreaterThan(linkBottom)
		})

		test('preselects requested plan query for both Plus and Family offers', async ({ page }) => {
			await openPricing(page)
			const offer = page.locator('#plus')
			test.skip((await offer.getByRole('radio').count()) === 0, 'sales are closed')
			for (const [interval, plan] of [
				['month', 'individual_monthly'],
				['once', 'individual_once'],
				['year', 'individual_yearly'],
			]) {
				await page.goto(`/pricing?plan=${plan}#plus`)
				await settle(page)
				const radio = offer.locator(`input[value="${interval}"]`)
				if ((await radio.count()) === 0) continue
				await expect(radio).toBeChecked()
			}
			const family = page.locator('#family')
			await page.goto('/pricing?plan=family_monthly#family')
			await settle(page)
			await expect(family).toContainText('$7.99')
			await expect(family.locator('input[value="month"]')).toBeChecked()
			await expect(family.getByRole('checkbox')).toHaveCount(0)
			await expect(family.getByRole('button', { name: 'Continue to payment' })).toBeEnabled()
		})

		test('starts cold-guest checkout directly with consent, attribution and callbackUrl, and prompts cleanly on return', async ({
			page,
		}) => {
			let capturedBody: Record<string, unknown> | null = null
			let capturedHeaders: Record<string, string> = {}
			await page.route('**/v1/guest/session', async (route) => {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({ issued: true }),
				})
			})
			await page.route('**/puzzled.v1.BillingService/CreateCheckout', async (route) => {
				capturedHeaders = route.request().headers()
				capturedBody = JSON.parse(route.request().postData() ?? '{}') as Record<string, unknown>
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						url: `${new URL(page.url()).origin}/settings/subscription?checkout=success&s=cs_e2e_guest_1&callbackUrl=%2Fgames%2Fsudoku`,
					}),
				})
			})

			const query = [
				'callbackUrl=%2Fgames%2Fsudoku',
				'utm_source=google',
				'utm_medium=cpc',
				'gclid=Cj0_e2e_test',
				'gbraid=gb_e2e',
				'wbraid=wb_e2e',
				'fbclid=fb_e2e',
			].join('&')
			await page.goto(`/pricing?${query}`, { waitUntil: 'domcontentloaded' })
			await settle(page)

			const offer = page.locator('#plus')
			test.skip((await offer.getByRole('radio').count()) === 0, 'sales are closed')
			await expect(offer.getByRole('checkbox')).toHaveCount(0)
			await offer.getByRole('button', { name: 'Continue to payment' }).click()

			await page.waitForURL(/\/settings\/subscription\?checkout=success&s=cs_e2e_guest_1/)
			await settle(page)

			expect(capturedBody).toMatchObject({
				planId: 'individual_yearly',
				locale: 'en-US',
			})
			expect(capturedBody).not.toMatchObject({ immediateSupplyConsent: true })
			const attrHeader = decodeURIComponent(capturedHeaders['x-puzzled-attribution'] ?? '')
			expect(attrHeader).toContain('g=Cj0_e2e_test')
			expect(attrHeader).toContain('gb=gb_e2e')
			expect(attrHeader).toContain('wb=wb_e2e')
			expect(attrHeader).toContain('fb=fb_e2e')
			expect(attrHeader).toContain('s=google')
			expect(capturedHeaders['x-puzzled-return-to']).toBe('/games/sudoku')

			// Post-payment unauthenticated claim prompt preserves return destination with zero secret leak.
			await expect(
				page.getByRole('heading', { name: 'Payment received — link your Tryit Plus' }),
			).toBeVisible()
			const createLink = page.getByRole('link', { name: 'Create account to activate Plus' })
			const signInLink = page.getByRole('link', { name: 'Sign in to link subscription' })
			await expect(createLink).toBeVisible()
			await expect(signInLink).toBeVisible()
			const createCallback = new URL(
				(await createLink.getAttribute('href')) ?? '',
				page.url(),
			).searchParams.get('callbackUrl')
			expect(createCallback).toBe(
				'/settings/subscription?checkout=success&s=cs_e2e_guest_1&callbackUrl=%2Fgames%2Fsudoku',
			)
			expect(page.url()).not.toContain('clm_')
		})

		test('puts currency beside the offer and ignores unknown plan requests', async ({ page }) => {
			await page.goto('/pricing?plan=not-a-plan')
			await settle(page)
			const offer = page.locator('#plus')
			const yearly = offer.locator('input[value="year"]')
			test.skip((await yearly.count()) === 0, 'sales are closed')
			await expect(yearly).toBeChecked()
			const currency = page.getByRole('group', { name: 'Currency', exact: true })
			if ((await currency.count()) > 0) await expect(currency).toBeInViewport({ ratio: 1 })
		})

		test('has no horizontal overflow', async ({ page }) => {
			await openPricing(page)
			expect(
				await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1),
			).toBe(false)
		})
	})
}

const THEME_MODES = ['light', 'dark'] as const

const CAPTURE_VIEWPORTS = [
	{ name: 'desktop-1440x900', width: 1440, height: 900 },
	{ name: 'mobile-390x844', width: 390, height: 844 },
] as const

const CURRENCY_CAPTURES = [
	{
		code: 'usd',
		starter: '$2.99',
		plusYearly: '$39.99',
		familyYearly: '$64.99',
	},
	{
		code: 'gbp',
		starter: '£2.99',
		plusYearly: '£29.99',
		familyYearly: '£47.99',
	},
	{
		code: 'jpy',
		starter: '¥479',
		plusYearly: '¥6,399',
		familyYearly: '¥10,389',
	},
	{
		code: 'idr',
		starter: /IDR\s*59,000(?!\.00)/,
		plusYearly: /IDR\s*729,000(?!\.00)/,
		plusMonthlyEq: /IDR\s*60,750(?!\.00)/,
		familyYearly: /IDR\s*1,189,000(?!\.00)/,
		familyMonthlyEq: /IDR\s*99,083(?!\.\d)/,
		free: /IDR\s*0(?!\.00)/,
	},
	{
		code: 'hkd',
		starter: /HK\$29(?!\.00)/,
		plusYearly: /HK\$319(?!\.00)/,
		plusMonthlyEq: 'HK$26.58',
		familyYearly: /HK\$519(?!\.00)/,
		free: /HK\$0(?!\.00)/,
	},
] as const

for (const viewport of CAPTURE_VIEWPORTS) {
	for (const colorScheme of THEME_MODES) {
		test.describe(`Pricing 16-currency matrix (${viewport.name}, ${colorScheme})`, () => {
			test.use({
				viewport: { width: viewport.width, height: viewport.height },
				colorScheme,
			})

			test('switches USD, GBP, JPY, IDR and HKD without overflow', async ({ page }, testInfo) => {
				await openPricing(page)
				const plus = page.locator('#plus')
				const yearly = plus.getByRole('radio', { name: /^Yearly/ })
				test.skip((await yearly.count()) === 0, 'sales are closed: no currency switcher')

				if (colorScheme === 'dark') {
					await expect(page.locator('html')).toHaveClass(/\bdark\b/)
				}

				const decline = page.getByRole('button', { name: 'Decline', exact: true })
				if (await decline.isVisible()) {
					await decline.click()
					await expect(decline).toHaveCount(0)
				}

				const select = page.getByRole('combobox', { name: 'Currency', exact: true })
				await expect(select).toBeVisible()
				await expect(select.locator('option')).toHaveCount(16)

				const family = page.locator('#family')
				for (const target of CURRENCY_CAPTURES) {
					if ((await select.inputValue()) !== target.code) {
						await select.selectOption(target.code)
					}
					await expect(select).toHaveValue(target.code)
					await expect(plus).toContainText(target.starter)
					await expect(plus).toContainText(target.plusYearly)
					if ('plusMonthlyEq' in target) {
						await expect(plus).toContainText(target.plusMonthlyEq)
					}
					await expect(family).toContainText(target.familyYearly)
					if ('familyMonthlyEq' in target) {
						await expect(family).toContainText(target.familyMonthlyEq)
					}
					if ('free' in target) {
						await expect(page.locator('#plans')).toContainText(target.free)
					}

					expect(
						await page.evaluate(() => document.documentElement.scrollWidth),
					).toBeLessThanOrEqual(viewport.width)

					const box = await select.boundingBox()
					expect(box).not.toBeNull()
					if (box) {
						expect(box.x).toBeGreaterThanOrEqual(0)
						expect(box.x + box.width).toBeLessThanOrEqual(viewport.width)
					}

					await page.evaluate(() => window.scrollTo(0, 0))
					await settle(page)
					const shotName = `pricing-${viewport.name}-${colorScheme}-${target.code}.png`
					await testInfo.attach(shotName, {
						body: await page.screenshot({
							fullPage: false,
							path: testInfo.outputPath(shotName),
						}),
						contentType: 'image/png',
					})
					if (viewport.width === 390 && target.code === 'idr') {
						const fullName = `pricing-${viewport.name}-${colorScheme}-idr-full.png`
						await testInfo.attach(fullName, {
							body: await page.screenshot({
								fullPage: true,
								path: testInfo.outputPath(fullName),
							}),
							contentType: 'image/png',
						})
					}
				}
			})
		})
	}
}
test.describe('Post-payment verified-email handoff and auth brand panel contrast', () => {
	test.use({ viewport: { width: 1440, height: 900 } })

	test('preserves session_id across signed-out /settings/subscription -> /login -> /signup without claim cookie', async ({
		page,
	}) => {
		await page.goto('/settings/subscription?checkout=success&session_id=cs_live_verify_probe', {
			waitUntil: 'domcontentloaded',
		})
		await settle(page)

		await expect(
			page.getByRole('heading', { name: 'Payment received — link your Tryit Plus' }),
		).toBeVisible()
		const expectedCallback = encodeURIComponent(
			'/settings/subscription?checkout=success&session_id=cs_live_verify_probe',
		)
		const createAccount = page.getByRole('link', { name: 'Create account to activate Plus' })
		const signIn = page.getByRole('link', { name: 'Sign in to link subscription' })
		await expect(createAccount).toHaveAttribute('href', `/signup?callbackUrl=${expectedCallback}`)
		await expect(signIn).toHaveAttribute('href', `/login?callbackUrl=${expectedCallback}`)

		await signIn.click()
		await page.waitForURL(`**/login?callbackUrl=${expectedCallback}`)
		await expect(page.getByRole('link', { name: 'Sign up' })).toHaveAttribute(
			'href',
			`/signup?callbackUrl=${expectedCallback}`,
		)
	})

	for (const colorScheme of ['light', 'dark'] as const) {
		test(`auth brand panel maintains WCAG AA contrast on dark ink surface in ${colorScheme} mode`, async ({
			page,
		}) => {
			await page.emulateMedia({ colorScheme })
			for (const authPath of ['/login', '/signup']) {
				await page.goto(authPath, { waitUntil: 'domcontentloaded' })
				await settle(page)
				const panel = page.locator('aside.surface-ink')
				await expect(panel).toBeVisible()

				const report = await panel.evaluate((aside) => {
					const parseRgba = (raw: string): [number, number, number, number] => {
						const canvas = document.createElement('canvas')
						canvas.width = 1
						canvas.height = 1
						const ctx = canvas.getContext('2d')
						if (!ctx) return [0, 0, 0, 1]
						ctx.clearRect(0, 0, 1, 1)
						ctx.fillStyle = raw
						ctx.fillRect(0, 0, 1, 1)
						const d = ctx.getImageData(0, 0, 1, 1).data
						return [d[0], d[1], d[2], d[3] / 255]
					}
					const composite = (
						fg: [number, number, number, number],
						bg: [number, number, number],
					): [number, number, number] => [
						fg[0] * fg[3] + bg[0] * (1 - fg[3]),
						fg[1] * fg[3] + bg[1] * (1 - fg[3]),
						fg[2] * fg[3] + bg[2] * (1 - fg[3]),
					]
					const luminance = ([r, g, b]: [number, number, number]) => {
						const chan = (v: number) => {
							const s = v / 255
							return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
						}
						return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b)
					}
					const contrast = (a: [number, number, number], b: [number, number, number]) => {
						const l1 = luminance(a)
						const l2 = luminance(b)
						return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
					}

					const bgRgba = parseRgba(getComputedStyle(aside).backgroundColor)
					const bg: [number, number, number] = [bgRgba[0], bgRgba[1], bgRgba[2]]
					const textNodes = Array.from(aside.querySelectorAll('h2, p, li, a'))
					const textMin = Math.min(
						...textNodes.map((el) =>
							contrast(composite(parseRgba(getComputedStyle(el).color), bg), bg),
						),
					)
					const checks = Array.from(aside.querySelectorAll('ul svg'))
					const checkMin = Math.min(
						...checks.map((el) =>
							contrast(composite(parseRgba(getComputedStyle(el).color), bg), bg),
						),
					)
					return { textCount: textNodes.length, textMin, checkCount: checks.length, checkMin }
				})

				expect(report.textCount).toBeGreaterThanOrEqual(8)
				expect(report.textMin).toBeGreaterThanOrEqual(7)
				expect(report.checkCount).toBe(3)
				expect(report.checkMin).toBeGreaterThanOrEqual(4.5)
			}
		})
	}
})
