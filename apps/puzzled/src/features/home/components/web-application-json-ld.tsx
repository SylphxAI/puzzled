import { getRequestSiteOrigin } from '@/lib/site-origin.server'
import catalogue from '../../../../../../config/commercial/catalogue.json'

/** Discovery prices come from the declaration applied to Money, never a second price list. */
export async function WebApplicationJsonLd({ locale }: { locale: string }) {
	const baseUrl = await getRequestSiteOrigin()
	const currency =
		(catalogue.currency_display.by_locale as Record<string, string>)[locale] ??
		catalogue.base_currency
	const nameFor = (names: Record<string, string>) => names[locale] ?? names['en-US']
	const schema = {
		'@context': 'https://schema.org',
		'@type': 'WebApplication',
		name: 'Puzzled',
		url: baseUrl,
		applicationCategory: 'GameApplication',
		operatingSystem: 'Any',
		publisher: {
			'@type': 'Organization',
			name: catalogue.seller.legal_name,
			url: 'https://sylphx.com',
		},
		offers: [
			{
				'@type': 'Offer',
				name: `${nameFor(catalogue.free.name)} daily puzzles`,
				price: (catalogue.free.price_minor / 100).toFixed(2),
				priceCurrency: currency.toUpperCase(),
				url: baseUrl,
			},
			...catalogue.plans
				.filter((plan) => plan.interval === 'month' || plan.interval === 'year')
				.flatMap((plan) => {
					const amount = (plan.unit_amounts as Record<string, number>)[currency]
					if (amount === undefined) return []
					const price = (amount / 100).toFixed(2)
					return [
						{
							'@type': 'Offer',
							name: nameFor(plan.name),
							price,
							priceCurrency: currency.toUpperCase(),
							url: `${baseUrl}/pricing`,
							priceSpecification: {
								'@type': 'UnitPriceSpecification',
								price,
								priceCurrency: currency.toUpperCase(),
								billingDuration: plan.interval === 'month' ? 'P1M' : 'P1Y',
								valueAddedTaxIncluded: plan.tax_behavior === 'inclusive',
							},
						},
					]
				}),
		],
	}
	return (
		<script
			type="application/ld+json"
			// biome-ignore lint/security/noDangerouslySetInnerHtml: config-derived JSON-LD with escaped HTML
			dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }}
		/>
	)
}
