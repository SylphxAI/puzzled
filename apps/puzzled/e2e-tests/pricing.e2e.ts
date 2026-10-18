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
			const offer = page.locator('#plus')
			const yearly = offer.getByRole('radio', { name: /^Yearly/ })
			test.skip((await yearly.count()) === 0, 'sales are closed: no plans to lead with')

			await expect(yearly).toBeChecked()
			await expect(offer.getByRole('radio', { name: /^Monthly/ })).not.toBeChecked()

			// Signed in: the unticked consent box and the one payment button. Guest: the sign-in link.
			const consent = offer.getByRole('checkbox')
			const payment = offer.getByRole('button', { name: 'Continue to payment' })
			const signIn = offer.getByRole('link', { name: 'Sign in to subscribe' })
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

		test('has no horizontal overflow', async ({ page }) => {
			await openPricing(page)
			expect(
				await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1),
			).toBe(false)
		})
	})
}
