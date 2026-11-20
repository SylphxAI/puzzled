import { describe, expect, mock, test } from 'bun:test'
import { createElement, type ReactNode } from 'react'
import { renderToReadableStream } from 'react-dom/server'
import { getAllGameMetadata } from '@/games/registry'
import { buildUseCaseJsonLd, USE_CASE_SPECS } from './use-case-specs'

function MockLink({ href, children, ...rest }: { href: string; children: ReactNode }) {
	return createElement('a', { href, ...rest }, children)
}

mock.module('@/lib/i18n/routing', () => ({
	Link: MockLink,
}))
mock.module('@/lib/site-origin.server', () => ({
	getCanonicalSiteOrigin: async () => 'https://tryit.fun',
	getRequestSiteOrigin: async () => 'https://tryit.fun',
}))

const { buildUseCaseMetadata, UseCaseLanding } = await import('./use-case-landing')

async function renderMarkup(element: ReactNode): Promise<string> {
	const stream = await renderToReadableStream(element)
	await stream.allReady
	return new Response(stream).text()
}

describe('Wave-2 BoFu use-case landing pages', () => {
	for (const [slug, spec] of Object.entries(USE_CASE_SPECS)) {
		test(`${slug} emits valid @graph SoftwareApplication + FAQPage JSON-LD and entry_surface CTAs`, async () => {
			const graphDoc = buildUseCaseJsonLd(spec)
			const roundTripped = JSON.parse(JSON.stringify(graphDoc)) as {
				'@context': string
				'@graph': Array<{ '@type': string; mainEntity?: unknown[]; offers?: unknown[] }>
			}
			expect(roundTripped['@context']).toBe('https://schema.org')
			expect(roundTripped['@graph'].map((node) => node['@type'])).toEqual([
				'SoftwareApplication',
				'FAQPage',
			])
			expect(roundTripped['@graph'][1]?.mainEntity?.length).toBe(4)

			const html = await renderMarkup(createElement(UseCaseLanding, { spec }))
			expect(html).toContain(`entry_surface=seo_${slug}`)
			expect(html).toContain(spec.faqs[0]?.question ?? '')
			const scriptMatches = [
				...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g),
			]
			expect(scriptMatches).toHaveLength(1)
			const parsed = JSON.parse(scriptMatches[0]?.[1] ?? '{}') as { '@graph': unknown[] }
			expect(parsed['@graph']).toHaveLength(2)
			expect(html).toMatch(/<h1[^>]*>[^<]+<\/h1>/)
		})
	}

	test('states exact shipped game count and ads.ts zero-ads-during-gameplay distinction', () => {
		const count = getAllGameMetadata().length
		const daily = USE_CASE_SPECS['daily-word-and-logic-puzzles-online']
		const family = USE_CASE_SPECS['family-brain-games-no-ads']
		expect(daily.eyebrow).toContain(`${count} daily puzzles`)
		expect(family.workflows[0]?.body).toContain(
			'never puts banners, pop-ups, or video ads on a puzzle board',
		)
		expect(family.faqs[0]?.answer).toContain('never shows ads while a puzzle is being played')
	})

	test('canonicalises non-US locale hits to canonical EN without hreflang alternates', async () => {
		for (const spec of Object.values(USE_CASE_SPECS)) {
			for (const locale of ['en-US', 'en-GB', 'zh-HK', 'ja', 'es', 'pt-BR']) {
				const metadata = await buildUseCaseMetadata(locale, spec)
				expect(metadata.alternates?.canonical).toBe(`https://tryit.fun${spec.path}`)
				expect(metadata.alternates?.languages).toBeUndefined()
				expect(metadata.openGraph?.url).toBe(`https://tryit.fun${spec.path}`)
				expect(metadata.openGraph?.locale).toBe('en_US')
			}
		}
	})
})
