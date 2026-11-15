import { expect, type Page, test } from '@playwright/test'
import { DESKTOP, MOBILE, settle } from './a11y-support'

/**
 * Pricing first screen: Puzzled Plus leads for every visitor.
 *
 * Yearly is preselected with Monthly beside it, and the one checkout step (the
 * consent tick and "Continue to payment" for a signed-in player, "Sign in to
 * subscribe" for a guest) sits inside the first screen with no scroll. The Free
 * card and the plan comparison sit below it; one text link keeps free play a tap
 * away. Skipped while sales are closed (the page then shows no plans).
 */

const VIEWPORTS = [
	{ name: 'mobile-390x844', ...MOBILE },
	{ name: 'desktop', ...DESKTOP },
]

async function openPricing(page: Page) {
	await page.goto('/pricing', { waitUntil: 'domcontentloaded' })
	await settle(page)
}

for (const viewport of VIEWPORTS) {
	test.describe(`Pricing first screen (${viewport.name})`, () => {
		test.use({ viewport: { width: viewport.width, height: viewport.height } })

		test('leads with Plus: Yearly preselected and the checkout step in view', async ({
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

			// Signed in: the unticked consent box and the one payment button. Guest: the sign-in link.
			const consent = offer.getByRole('checkbox')
			const payment = offer.getByRole('button', { name: 'Continue to payment' })
			const signIn = offer.getByRole('link', { name: /^Sign in to subscribe/ })
			if ((await payment.count()) > 0) {
				await expect(consent).not.toBeChecked()
				await expect(consent).toBeInViewport({ ratio: 1 })
				await expect(payment).toBeInViewport({ ratio: 1 })
			} else {
				await expect(signIn).toBeInViewport({ ratio: 1 })
			}

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

		test('keeps the selected plan through the sign-in return', async ({ page }) => {
			await openPricing(page)
			const offer = page.locator('#plus')
			test.skip((await offer.getByRole('radio').count()) === 0, 'sales are closed')
			const signIn = offer.getByRole('link', { name: /^Sign in to subscribe/ })
			test.skip((await signIn.count()) === 0, 'guest return-path test')
			for (const [interval, plan, name] of [
				['month', 'individual_monthly', 'Monthly'],
				['once', 'individual_once', '3-day pass'],
				['year', 'individual_yearly', 'Yearly'],
			]) {
				const radio = offer.locator(`input[value="${interval}"]`)
				if ((await radio.count()) === 0) continue
				await radio.check()
				await expect(signIn).toContainText(name)
				const href = await signIn.getAttribute('href')
				const callback = new URL(href ?? '', page.url()).searchParams.get('callbackUrl')
				expect(callback).toBe(`/pricing?plan=${plan}#plus`)
				// Follow only the local return URL; never sign in or create a checkout.
				await page.goto(callback ?? '/pricing')
				await expect(radio).toBeChecked()
			}
		})

		test('keeps one Family sign-in link with its own return destination', async ({ page }) => {
			await openPricing(page)
			const family = page.locator('#family')
			test.skip((await family.count()) === 0, 'sales are closed')
			await expect(family).toContainText('$64.99')
			await expect(family.getByRole('radio', { name: /^Yearly/ })).toBeChecked()
			const signIn = family.getByRole('link', { name: /^Sign in to subscribe/ })
			await expect(signIn).toHaveCount(1)
			await expect(signIn).toHaveText(
				/^Sign in to subscribe · Puzzled Plus Family · (Yearly|Monthly)$/,
			)
			const href = await signIn.getAttribute('href')
			const callback = new URL(href ?? '', page.url()).searchParams.get('callbackUrl')
			const interval = (await signIn.textContent())?.endsWith('Yearly') ? 'yearly' : 'monthly'
			expect(callback).toBe(`/pricing?plan=family_${interval}#family`)
			// Exercise the local return destination without creating a login or checkout.
			await page.goto(callback ?? '/pricing')
			await expect(family).toBeInViewport()
			await expect(signIn).toHaveCount(1)
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

		test('preserves ad click ids in sessionStorage across sign-in before cookie consent', async ({
			page,
		}) => {
			const query = [
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
			const signIn = offer.getByRole('link', { name: /^Sign in to subscribe/ })
			test.skip((await signIn.count()) === 0, 'guest attribution sign-in flow')
			await signIn.click()
			await page.waitForURL(/\/login/)
			await settle(page)
			const stored = await page.evaluate(() =>
				window.sessionStorage.getItem('puzzled:attr:session'),
			)
			expect(stored).not.toBeNull()
			const decoded = decodeURIComponent(stored ?? '')
			expect(decoded).toContain('g=Cj0_e2e_test')
			expect(decoded).toContain('gb=gb_e2e')
			expect(decoded).toContain('wb=wb_e2e')
			expect(decoded).toContain('fb=fb_e2e')
			expect(decoded).toContain('s=google')
		})

		test('has no horizontal overflow', async ({ page }) => {
			await openPricing(page)
			expect(
				await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1),
			).toBe(false)
		})
	})
}
