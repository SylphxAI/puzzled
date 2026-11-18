import { describe, expect, mock, test } from 'bun:test'
import { createElement, type ReactNode } from 'react'
import { renderToReadableStream } from 'react-dom/server'
import { getAllGameMetadata, getGameMetadata } from '@/games/registry'
import { listPrice } from './catalogue-prices'
import { COMPARISON_SPECS } from './comparison-specs'
import { buildUseCaseJsonLd } from './use-case-specs'

function MockLink({ href, children, ...rest }: { href: string; children: ReactNode }) {
	return createElement('a', { href, ...rest }, children)
}

mock.module('@/lib/i18n/routing', () => ({
	Link: MockLink,
}))

const { ComparisonLanding } = await import('./comparison-landing')

async function renderMarkup(element: ReactNode): Promise<string> {
	const stream = await renderToReadableStream(element)
	await stream.allReady
	return new Response(stream).text()
}

const spec = COMPARISON_SPECS['nyt-games']

/** Every string a visitor can read on the page, JSON-LD excluded. */
function visibleCopy(): string {
	return JSON.stringify({ ...spec, offers: undefined, softwareDescription: undefined })
}

describe('/vs/nyt-games comparison page', () => {
	test('renders one h1, entry-surface CTAs and one SoftwareApplication + FAQPage graph', async () => {
		const html = await renderMarkup(createElement(ComparisonLanding, { spec }))
		expect(html.match(/<h1[\s>]/g)).toHaveLength(1)
		expect(html).toContain('href="/?entry_surface=seo_vs-nyt-games"')
		expect(html).toContain('href="/pricing?entry_surface=seo_vs-nyt-games"')
		const scripts = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
		expect(scripts).toHaveLength(1)
		const graph = JSON.parse(scripts[0]?.[1] ?? '{}') as {
			'@graph': Array<{ '@type': string; mainEntity?: unknown[]; url?: string }>
		}
		expect(graph['@graph'].map((node) => node['@type'])).toEqual(['SoftwareApplication', 'FAQPage'])
		expect(graph['@graph'][0]?.url).toBe('https://tryit.fun/vs/nyt-games')
		expect(graph['@graph'][1]?.mainEntity).toHaveLength(spec.faqs.length)
		for (const faq of spec.faqs) expect(html).toContain(faq.question)
		expect(html).toContain(
			'not affiliated with, endorsed by or sponsored by The New York Times Company',
		)
	})

	test('links every pairing to a registered game page by its catalogue name', async () => {
		const html = await renderMarkup(createElement(ComparisonLanding, { spec }))
		for (const pairing of spec.pairings) {
			const game = getGameMetadata(pairing.slug)
			expect(game).not.toBeNull()
			expect(html).toContain(`href="/games/${pairing.slug}"`)
			expect(html).toContain(`Try ${game?.name}`)
		}
	})

	test('states the live free floor and catalogue prices, never internal names', () => {
		const copy = visibleCopy()
		const total = getAllGameMetadata().length
		expect(spec.facts).toContain('Any 3 free every day')
		expect(spec.lead).toContain(`${total} word, logic, number and spatial puzzles`)
		expect(copy).toContain(`3-Day Pass: ${listPrice('puzzled_starter_unlock')} once, no renewal`)
		expect(copy).toContain(
			`Plus ${listPrice('plus_individual_monthly')}/month or ${listPrice('plus_individual_yearly')}/year`,
		)
		expect(copy).toContain(
			`${listPrice('plus_family_monthly')}/month or ${listPrice('plus_family_yearly')}/year`,
		)
		expect(copy).not.toMatch(/Sylphx|Keel|Spiron|featured puzzle is free/i)
	})

	test('the table counts every registered game once by category', () => {
		const daily = spec.rows.find((row) => row.feature === 'Daily games')?.us ?? ''
		const counts = [...daily.matchAll(/(\d+) (word|logic|number|spatial)/g)].map((m) =>
			Number(m[1]),
		)
		expect(counts.reduce((sum, n) => sum + n, 0)).toBe(getAllGameMetadata().length)
	})

	test('offers in the JSON-LD match the catalogue', () => {
		const offers = buildUseCaseJsonLd(spec)['@graph'][0] as {
			offers: { name: string; price: string }[]
		}
		const byName = Object.fromEntries(offers.offers.map((offer) => [offer.name, offer.price]))
		expect(`$${byName['3-Day Pass']}`).toBe(listPrice('puzzled_starter_unlock'))
		expect(`$${byName['Tryit Plus (Monthly)']}`).toBe(listPrice('plus_individual_monthly'))
		expect(`$${byName['Tryit Family (Yearly)']}`).toBe(listPrice('plus_family_yearly'))
	})
})
