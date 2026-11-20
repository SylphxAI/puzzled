import { describe, expect, mock, test } from 'bun:test'
import { createElement, type ReactNode } from 'react'
import { renderToReadableStream } from 'react-dom/server'
import { locales } from '@/lib/i18n/config'
import { COMPARISON_SLUGS } from './comparison-slugs'
import { COMPARISON_HUB, COMPARISON_SPECS } from './comparison-specs'

/**
 * The `/vs` routes as Next calls them: `generateStaticParams`, `generateMetadata`
 * and the page component, for every comparison in every locale, plus the hub.
 * `notFound()` throws as Next's does, so an unknown slug is observable.
 */
const ORIGIN = 'https://tryit.fun'
const NOT_FOUND = 'NEXT_HTTP_ERROR_FALLBACK;404'

function MockLink({ href, children, ...rest }: { href: string; children: ReactNode }) {
	return createElement('a', { href, ...rest }, children)
}

mock.module('@/lib/i18n/routing', () => ({ Link: MockLink }))
mock.module('@/lib/site-origin.server', () => ({
	getCanonicalSiteOrigin: async () => ORIGIN,
	getRequestSiteOrigin: async () => ORIGIN,
}))
mock.module('next-intl/server', () => ({
	setRequestLocale: () => {},
	getTranslations: async () => (key: string) => key,
}))
mock.module('next/navigation', () => ({
	notFound: () => {
		throw new Error(NOT_FOUND)
	},
}))

const { canonicalUrl } = await import('@/lib/seo/metadata')
const rivalRoute = (await import(
	'@/app/[locale]/(main)/vs/[rival]/page'
)) as typeof import('@/app/[locale]/(main)/vs/[rival]/page')
const hubRoute = (await import(
	'@/app/[locale]/(main)/vs/page'
)) as typeof import('@/app/[locale]/(main)/vs/page')

async function renderMarkup(element: ReactNode): Promise<string> {
	const stream = await renderToReadableStream(element)
	await stream.allReady
	return new Response(stream).text()
}

function jsonLd(html: string): unknown[] {
	return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(
		(match) => JSON.parse(match[1] ?? 'null'),
	)
}

const rivalParams = (locale: string, rival: string) => ({
	params: Promise.resolve({ locale, rival }),
})

describe('/vs/[rival]', () => {
	test('statically lists every comparison in every locale, once', () => {
		const params = rivalRoute.generateStaticParams()
		expect(params).toHaveLength(locales.length * COMPARISON_SLUGS.length)
		expect(new Set(params.map((p) => `${p.locale}/${p.rival}`)).size).toBe(params.length)
		expect(COMPARISON_SLUGS).toEqual([
			'nyt-games',
			'lumosity',
			'linkedin-games',
			'elevate',
			'puzzmo',
			'brilliant',
			'wordle',
		])
	})

	for (const slug of COMPARISON_SLUGS) {
		const spec = COMPARISON_SPECS[slug]
		for (const locale of locales) {
			test(`${locale} ${spec.path}: canonicalises to EN with no hreflang cluster and renders from spec`, async () => {
				const metadata = await rivalRoute.generateMetadata(rivalParams(locale, slug))
				const canonical = canonicalUrl(ORIGIN, 'en-US', spec.path)
				expect(metadata.title).toBe(spec.metaTitle)
				expect(metadata.description).toBe(spec.metaDescription)
				expect(metadata.alternates?.canonical).toBe(canonical)
				expect(metadata.alternates?.languages).toBeUndefined()
				expect(metadata.openGraph?.url).toBe(canonical)
				expect(metadata.openGraph?.locale).toBe('en_US')
				expect(metadata.openGraph?.alternateLocale).toBeUndefined()

				const html = await renderMarkup(await rivalRoute.default(rivalParams(locale, slug)))
				expect(html.match(/<h1[\s>]/g)).toHaveLength(1)
				expect(html).toContain(`href="/?entry_surface=seo_vs-${slug}"`)
				expect(html).toContain(`href="/pricing?entry_surface=seo_vs-${slug}"`)
				expect(html).toContain('href="/vs"')
				const [graph] = jsonLd(html) as [{ '@graph': { '@type': string }[] }]
				expect(graph['@graph'].map((node) => node['@type'])).toEqual([
					'SoftwareApplication',
					'FAQPage',
					'BreadcrumbList',
				])
			})
		}
	}

	test('an unknown or mis-cased slug is a 404, in metadata and in the page', async () => {
		for (const rival of ['nonexistent', 'unknown-rival', 'NYT-Games', 'brilliant.org', '']) {
			await expect(rivalRoute.generateMetadata(rivalParams('en-US', rival))).rejects.toThrow(
				NOT_FOUND,
			)
			await expect(rivalRoute.default(rivalParams('zh-HK', rival))).rejects.toThrow(NOT_FOUND)
		}
	})
})

describe('/vs hub', () => {
	for (const locale of locales) {
		test(`${locale} /vs: canonicalises to EN with no hreflang cluster`, async () => {
			const metadata = await hubRoute.generateMetadata({ params: Promise.resolve({ locale }) })
			const canonical = canonicalUrl(ORIGIN, 'en-US', '/vs')
			expect(metadata.title).toBe(COMPARISON_HUB.metaTitle)
			expect(metadata.description).toBe(COMPARISON_HUB.metaDescription)
			expect(metadata.alternates?.canonical).toBe(canonical)
			expect(metadata.alternates?.languages).toBeUndefined()
			expect(metadata.openGraph?.url).toBe(canonical)
			expect(metadata.openGraph?.locale).toBe('en_US')
		})
	}

	test('links every comparison, both offers and one ItemList of the same pages', async () => {
		const html = await renderMarkup(
			await hubRoute.default({ params: Promise.resolve({ locale: 'en-US' }) }),
		)
		expect(html.match(/<h1[\s>]/g)).toHaveLength(1)
		expect(html).toContain('href="/?entry_surface=seo_vs-hub"')
		expect(html).toContain('href="/pricing?entry_surface=seo_vs-hub"')
		for (const slug of COMPARISON_SLUGS) {
			const spec = COMPARISON_SPECS[slug]
			expect(html).toContain(`href="${spec.path}"`)
			expect(html).toContain(`Tryit vs ${spec.rival}`)
			// The card states the comparison's own verdict, nothing new.
			expect(html).toContain(spec.verdict[0].replaceAll("'", '&#x27;'))
		}
		const [collection] = jsonLd(html) as [
			{
				'@type': string
				url: string
				mainEntity: { itemListElement: { position: number; url: string }[] }
			},
		]
		expect(collection['@type']).toBe('CollectionPage')
		expect(collection.url).toBe(`${ORIGIN}/vs`)
		expect(collection.mainEntity.itemListElement.map((item) => item.url)).toEqual(
			COMPARISON_SLUGS.map((slug) => `${ORIGIN}/vs/${slug}`),
		)
		expect(html).not.toMatch(/Sylphx|Keel|Spiron|AnyAgents/i)
	})
})
