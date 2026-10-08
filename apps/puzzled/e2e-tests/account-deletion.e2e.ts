import { expect, test } from '@playwright/test'

test('signed-out visitors can reach the web deletion route from the footer', async ({ page }) => {
	await page.goto('/privacy')
	await page.locator('footer').getByRole('link', { name: 'Delete account', exact: true }).click()
	await expect(page).toHaveURL(/\/delete-account$/)
	await expect(
		page.getByRole('heading', { level: 1, name: 'Delete your Puzzled account' }),
	).toBeVisible()
	const signIn = page.getByRole('link', { name: 'Sign in to delete your account' })
	await expect(signIn).toHaveAttribute('href', '/login?callbackUrl=%2Fsettings%2Faccount')
	await expect(page.getByRole('link', { name: 'Recover your account' })).toHaveAttribute(
		'href',
		'/forgot-password',
	)
	await expect(page.getByRole('link', { name: /Request deletion by email/ })).toHaveAttribute(
		'href',
		/^mailto:.*subject=Puzzled%20account%20deletion%20request$/,
	)
	await expect(
		page.getByText(/Payment and refund records are retained without your player ID/),
	).toBeVisible()
	await expect(page.getByText(/cancel it in Billing before deleting your account/)).toBeVisible()
})
