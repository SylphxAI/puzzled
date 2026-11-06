import { expect, test } from '@playwright/test'
import catalogue from '../../../config/commercial/catalogue.json'

for (const { path, locale, currency } of [
	{ path: '/', locale: 'en-US', currency: 'usd' },
	{ path: '/en-GB', locale: 'en-GB', currency: 'gbp' },
]) {
	test(`${path} publishes the application, configured offers and operator in rendered JSON-LD`, async ({
		page,
	}) => {
		const response = await page.goto(path)
		expect(response?.status()).toBe(200)
		const schemas = (
			await page.locator('script[type="application/ld+json"]').allTextContents()
		).map((text) => JSON.parse(text))
		const apps = schemas.filter((schema) => schema['@type'] === 'WebApplication')
		expect(apps).toHaveLength(1)
		const app = apps[0]
		expect(app).toMatchObject({
			'@context': 'https://schema.org',
			name: 'Puzzled',
			applicationCategory: 'GameApplication',
			operatingSystem: 'Any',
			publisher: {
				'@type': 'Organization',
				name: 'Sylphx Limited',
				url: 'https://sylphx.com',
			},
		})
		expect(app.offers).toEqual([
			{
				'@type': 'Offer',
				name: 'Free daily puzzles',
				price: '0.00',
				priceCurrency: currency.toUpperCase(),
				url: app.url,
			},
			...catalogue.plans
				.filter((plan) => plan.interval === 'month' || plan.interval === 'year')
				.map((plan) => {
					const price = ((plan.unit_amounts as Record<string, number>)[currency] / 100).toFixed(2)
					return {
						'@type': 'Offer',
						name: (plan.name as Record<string, string>)[locale] ?? plan.name['en-US'],
						price,
						priceCurrency: currency.toUpperCase(),
						url: `${app.url}/pricing`,
						priceSpecification: {
							'@type': 'UnitPriceSpecification',
							price,
							priceCurrency: currency.toUpperCase(),
							billingDuration: plan.interval === 'month' ? 'P1M' : 'P1Y',
							valueAddedTaxIncluded: true,
						},
					}
				}),
		])
		const organization = schemas.find((schema) => schema['@type'] === 'Organization')
		expect(organization).toMatchObject({
			name: 'Puzzled',
			url: app.url,
			parentOrganization: {
				'@type': 'Organization',
				name: 'Sylphx Limited',
				url: 'https://sylphx.com',
				identifier: '16438428',
			},
			contactPoint: {
				'@type': 'ContactPoint',
				email: 'hi@puzzled.gg',
				telephone: '+44 7537 188 188',
				contactType: 'customer support',
			},
		})
		expect(JSON.stringify(schemas)).not.toMatch(/16686526|Shelton Street/)
	})
}

for (const path of ['/terms', '/privacy']) {
	test(`${path} renders the registered company and usable contact links`, async ({ page }) => {
		const response = await page.goto(path)
		expect(response?.status()).toBe(200)
		const main = page.getByRole('main')
		const text = await main.textContent()
		expect(text).toContain('Sylphx Limited')
		expect(text).toContain('16438428')
		expect(text).toContain('England and Wales')
		// Same registered office, in the postal order already used by the legal pages.
		expect(text).toContain('128 City Road, London EC1V 2NX, United Kingdom')
		expect(text).not.toMatch(/16686526|Shelton Street/)
		await expect(main.locator('a[href="mailto:hi@puzzled.gg"]')).toHaveText('hi@puzzled.gg')
		await expect(main.locator('a[href="tel:+447537188188"]')).toHaveText('+44 7537 188 188')
	})
}
