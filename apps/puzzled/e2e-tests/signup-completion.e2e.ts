import { expect, test } from '@playwright/test'

// Synthetic browser responses only: never create accounts to force completion failures.
const email = 'signup-recovery@example.test'
const password = 'Only-A-Synthetic-Password-123!'
const retryLabel = 'Try signing in again'

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

test.beforeEach(async ({ page }) => {
	await page.route('**/api/identity/session', (route) => route.fulfill({ json: { user: null } }))
	await page.goto('/en-GB/signup?callbackUrl=%2Fen-GB%2Fgames%2Fsudoku')
	await page.waitForFunction(() =>
		['name', 'email', 'password'].every((id) => {
			const field = document.getElementById(id)
			return field && Object.keys(field).some((key) => key.startsWith('__reactProps'))
		}),
	)
	await page.locator('#name').fill('Synthetic player')
	await page.locator('#email').fill(email)
	await page.locator('#password').fill(password)
	await page.locator('#password').blur()
})

for (const answer of [
	'explicit-failure',
	'legacy-false',
	'missing-result',
	'unreadable',
	'lost-response',
] as const) {
	test(`${answer}: retains fields, shows error and retries sign-in without another signup`, async ({
		page,
	}) => {
		let signups = 0
		let logins = 0
		await page.route('**/api/identity/signup', async (route) => {
			signups++
			if (answer === 'lost-response') return route.abort('failed')
			if (answer === 'unreadable') return route.fulfill({ status: 200, body: 'not json' })
			return route.fulfill({
				status: answer === 'explicit-failure' ? 502 : 200,
				json:
					answer === 'explicit-failure'
						? { error: 'signup_signin_failed', retrySignIn: true }
						: answer === 'legacy-false'
							? { signedIn: false }
							: {},
			})
		})
		await page.route('**/api/identity/login', async (route) => {
			logins++
			expect(route.request().postDataJSON()).toEqual({ email, password })
			return route.fulfill({
				status: logins === 1 ? 401 : 200,
				json: logins === 1 ? { error: 'identity_rejected' } : {},
			})
		})
		await page.locator('button[type="submit"]').click()
		await expect(page.getByRole('status')).toContainText("couldn't sign you in")
		await expect(page.getByRole('heading', { name: 'Check your email' })).toHaveCount(0)
		await expect(page.locator('#email')).toHaveValue(email)
		await expect(page.locator('#password')).toHaveValue(password)
		await expect(page.locator('#name')).toHaveValue('Synthetic player')
		const retry = page.getByRole('button', { name: retryLabel })
		await expect(retry).toBeEnabled()
		await retry.click()
		await expect(page.getByRole('status')).toContainText(/Check your email.*password/)
		await retry.click()
		await expect(page).toHaveURL(/\/games\/sudoku(?:\?|$)/)
		expect(signups).toBe(1)
		expect(logins).toBe(2)
	})
}

test('successful completion preserves the safe destination', async ({ page }) => {
	await page.route('**/api/identity/signup', (route) => route.fulfill({ json: { signedIn: true } }))
	await page.locator('button[type="submit"]').click()
	await expect(page).toHaveURL(/\/games\/sudoku(?:\?|$)/)
})

test('changing address allows a new signup, returning to the accepted address still signs in', async ({
	page,
}) => {
	let signups = 0
	let logins = 0
	await page.route('**/api/identity/signup', (route) => {
		signups++
		return route.fulfill({
			status: 502,
			json: { error: 'signup_signin_failed', retrySignIn: true },
		})
	})
	await page.route('**/api/identity/login', (route) => {
		logins++
		return route.fulfill({ status: 401, json: { error: 'identity_rejected' } })
	})
	await page.locator('button[type="submit"]').click()
	await expect(page.getByRole('button', { name: retryLabel })).toBeVisible()
	await page.locator('#email').fill('another@example.test')
	await expect(page.locator('button[type="submit"]')).not.toHaveText(retryLabel)
	await page.locator('button[type="submit"]').click()
	await expect(page.getByRole('button', { name: retryLabel })).toBeVisible()
	await page.locator('#email').fill(` ${email.toUpperCase()} `)
	await expect(page.getByRole('button', { name: retryLabel })).toBeVisible()
	await page.getByRole('button', { name: retryLabel }).click()
	await expect(page.getByRole('status')).toContainText(/Check your email.*password/)
	expect(signups).toBe(2)
	expect(logins).toBe(1)
})
