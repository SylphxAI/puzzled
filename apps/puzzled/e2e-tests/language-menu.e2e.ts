import { expect, test } from '@playwright/test'
import { DESKTOP } from './a11y-support'

test.use({ viewport: DESKTOP })

test('the language trigger becomes actionable only after hydration', async ({ page }) => {
	let release!: () => void
	const scripts = new Promise<void>((resolve) => {
		release = resolve
	})
	await page.route('**/_next/static/**/*.js', async (route) => {
		await scripts
		await route.continue()
	})
	try {
		await page.goto('/', { waitUntil: 'commit' })
		const trigger = page.getByRole('button', { name: 'Change language', exact: true }).first()
		await expect(trigger).toBeVisible()
		await expect(trigger).toBeDisabled()
		await expect(trigger).toHaveAttribute('aria-busy', 'true')
		await expect(trigger.getByRole('status')).toBeVisible()
		release()
		await trigger.click()
		await expect(page.getByRole('menu')).toBeVisible()
	} finally {
		release()
	}
})

test('guest admission preserves the header and its open language menu', async ({ page }) => {
	let release!: () => void
	const admission = new Promise<void>((resolve) => {
		release = resolve
	})
	await page.route('**/v1/guest/session', async (route) => {
		await admission
		await route.fulfill({
			json: { issued: true },
			// Any cookie switches the shared document to the private RSC payload.
			// This fixture is not an identity credential.
			headers: { 'set-cookie': 'puzzled-test-admission=1; Path=/; SameSite=Lax' },
		})
	})
	try {
		await page.goto('/', { waitUntil: 'domcontentloaded' })
		const trigger = page.getByRole('button', { name: 'Change language', exact: true }).first()
		await trigger.click()
		const menu = page.getByRole('menu')
		await expect(menu).toBeVisible()
		const header = await page.locator('header').elementHandle()
		const watch = await header!.evaluateHandle((element) => {
			let finish!: (retained: boolean) => void
			const retained = new Promise<boolean>((resolve) => {
				finish = resolve
			})
			const observer = new MutationObserver(() => {
				if (!element.isConnected) finish(false)
			})
			observer.observe(document.documentElement, { subtree: true, childList: true })
			return {
				retained,
				stop() {
					observer.disconnect()
					finish(element.isConnected)
				},
			}
		})
		const refreshed = page.waitForResponse(
			(response) =>
				new URL(response.url()).pathname === '/' &&
				response.request().headers().rsc === '1' &&
				!response.request().headers()['next-router-prefetch'],
		)
		release()
		const response = await refreshed
		expect(response.ok()).toBe(true)
		// Chrome has at most two sequential 1s presentation reads. Observe
		// beyond that deadline; an open RSC stream need not reach EOF to commit.
		const retained = await Promise.race([
			watch.evaluate((recorder) => recorder.retained),
			new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 2500)),
		])
		await watch.evaluate((recorder) => recorder.stop())
		await watch.dispose()
		expect(retained, 'guest refresh remounted the header').toBe(true)
		await expect(menu).toBeVisible()
		await expect(trigger).toHaveAttribute('aria-expanded', 'true')
		await page.keyboard.press('Escape')
		await expect(menu).toBeHidden()
		await expect(trigger).toBeFocused()
		await trigger.click()
		await expect(menu).toBeVisible()
	} finally {
		release()
	}
})
