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

const SPECS = Object.values(COMPARISON_SPECS)

test('each comparison page has its own path, entry surface and rival', () => {
	expect(SPECS.map((spec) => spec.path)).toEqual([
		'/vs/nyt-games',
		'/vs/lumosity',
		'/vs/linkedin-games',
		'/vs/elevate',
		'/vs/puzzmo',
		'/vs/brilliant',
		'/vs/wordle',
	])
	expect(new Set(SPECS.map((spec) => spec.rival)).size).toBe(SPECS.length)
	expect(new Set(SPECS.map((spec) => spec.primaryCta.href)).size).toBe(SPECS.length)
})

for (const spec of SPECS) {
	/** Every string a visitor can read on the page, JSON-LD excluded. */
	const visibleCopy = JSON.stringify({ ...spec, offers: undefined, softwareDescription: undefined })

	describe(`${spec.path} comparison page`, () => {
		test('renders one h1, entry CTAs and one SoftwareApplication + FAQPage + BreadcrumbList graph', async () => {
			const html = await renderMarkup(createElement(ComparisonLanding, { spec }))
			expect(html.match(/<h1[\s>]/g)).toHaveLength(1)
			expect(html).toContain(`href="/?entry_surface=seo_vs-${spec.slug}"`)
			expect(html).toContain(`href="/pricing?entry_surface=seo_vs-${spec.slug}"`)
			const scripts = [
				...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g),
			]
			expect(scripts).toHaveLength(1)
			const graph = JSON.parse(scripts[0]?.[1] ?? '{}') as {
				'@graph': Array<{
					'@type': string
					mainEntity?: { name: string; acceptedAnswer: { text: string } }[]
					itemListElement?: { item: string }[]
					url?: string
				}>
			}
			expect(graph['@graph'].map((node) => node['@type'])).toEqual([
				'SoftwareApplication',
				'FAQPage',
				'BreadcrumbList',
			])
			expect(graph['@graph'][0]?.url).toBe(`https://tryit.fun${spec.path}`)
			// Visible FAQ and FAQPage are the same list, in the same order.
			expect(graph['@graph'][1]?.mainEntity?.map((q) => [q.name, q.acceptedAnswer.text])).toEqual(
				spec.faqs.map((faq) => [faq.question, faq.answer]),
			)
			expect(graph['@graph'][2]?.itemListElement?.map((step) => step.item)).toEqual([
				'https://tryit.fun',
				'https://tryit.fun/vs',
				`https://tryit.fun${spec.path}`,
			])
			expect(html).toContain('href="/vs"')
			for (const faq of spec.faqs) expect(html).toContain(faq.question)
			expect(spec.disclaimer).toMatch(/^Tryit is independent and not affiliated with/)
			expect(spec.disclaimer).toContain('checked against')
			expect(html).toContain(spec.disclaimer.slice(0, spec.disclaimer.indexOf('. ')))
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
			const total = getAllGameMetadata().length
			expect(spec.facts).toContain('Any 3 free every day')
			expect(spec.lead).toContain(`${total} word, logic, number and spatial`)
			expect(visibleCopy).toContain(
				`3-Day Pass: ${listPrice('puzzled_starter_unlock')} once, no renewal`,
			)
			expect(visibleCopy).toContain(
				`${listPrice('plus_individual_monthly')}/month or ${listPrice('plus_individual_yearly')}/year`,
			)
			expect(visibleCopy).toContain(
				`${listPrice('plus_family_monthly')}/month or ${listPrice('plus_family_yearly')}/year`,
			)
			expect(visibleCopy).not.toMatch(/Sylphx|Keel|Spiron|AnyAgents|featured puzzle is free/i)
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
}

describe('/vs/brilliant specifics', () => {
	const spec = COMPARISON_SPECS.brilliant
	const visibleCopy = JSON.stringify({ ...spec, offers: undefined, softwareDescription: undefined })

	test('pairs Brilliant fans only with logic, number and spatial-reasoning games that exist', () => {
		const categories = spec.pairings.map((pairing) => getGameMetadata(pairing.slug)?.category)
		expect(categories.every((category) => category !== undefined)).toBe(true)
		expect(new Set(categories)).toEqual(new Set(['math', 'logic', 'spatial', 'word']))
		// The one word game is Cipher, a substitution puzzle, never a vocabulary game.
		expect(spec.pairings.filter((p) => getGameMetadata(p.slug)?.category === 'word')).toEqual([
			expect.objectContaining({ slug: 'cryptogram' }),
		])
	})

	test('quotes no Brilliant price, because Brilliant varies it by plan and offer', () => {
		const brilliantSide = JSON.stringify(spec.rows.map((row) => row.them))
		expect(brilliantSide).not.toMatch(/[$£€¥]\s?\d/)
		for (const faq of spec.faqs) {
			const brilliantPart = faq.answer.split('Brilliant Premium')[1] ?? ''
			expect(brilliantPart).not.toMatch(/[$£€¥]\s?\d/)
		}
		expect(visibleCopy).toContain('18 November 2026')
	})
})

describe('/vs/wordle specifics', () => {
	const spec = COMPARISON_SPECS.wordle
	const visibleCopy = JSON.stringify({ ...spec, offers: undefined, softwareDescription: undefined })

	test('leads with Five and Quad for Wordle fans and quotes no NYT price', () => {
		expect(spec.pairings.slice(0, 2).map((pairing) => pairing.slug)).toEqual([
			'word-guess',
			'quad-words',
		])
		const wordleSide = JSON.stringify(spec.rows.map((row) => row.them))
		expect(wordleSide).not.toMatch(/[$£€¥]\s?\d/)
		expect(visibleCopy).toContain('20 November 2026')
	})
})
