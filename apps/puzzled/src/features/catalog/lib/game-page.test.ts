import { describe, expect, mock, test } from 'bun:test'

/**
 * The metadata path resolves a module through the registry and rejects
 * anything unregistered. `next/navigation` is mocked so the rejection is
 * observable: Next's real `notFound()` throws the same way, and the page only
 * sees the resolved module when the slug is registered.
 */
mock.module('next/navigation', () => ({
	notFound: () => {
		throw new Error('NEXT_HTTP_ERROR_FALLBACK;404')
	},
	redirect: () => {
		throw new Error('NEXT_REDIRECT')
	},
	permanentRedirect: () => {
		throw new Error('NEXT_REDIRECT')
	},
	usePathname: () => '/',
	useRouter: () => ({
		back: () => {},
		forward: () => {},
		prefetch: () => {},
		push: () => {},
		replace: () => {},
	}),
	useSearchParams: () => new URLSearchParams(),
}))

const { parseGameFaq, parseGameTips, requireGamePage, resolveGamePage } = await import(
	'./game-page'
)
const { generateMetadata } = (await import(
	'@/app/[locale]/(main)/games/[slug]/page'
)) as typeof import('@/app/[locale]/(main)/games/[slug]/page')

describe('resolveGamePage', () => {
	test('returns the registry module and its canonical slug', () => {
		const resolved = resolveGamePage('sudoku')

		expect(resolved?.slug).toBe('sudoku')
		expect(resolved?.metadata.slug).toBe('sudoku')
		expect(resolved?.metadata.display.theme).toBe('cyan')
		expect(resolved?.metadata.category).toBe('logic')
	})

	test('canonicalises inbound aliases onto the registered module', () => {
		expect(resolveGamePage('queens')?.slug).toBe('crowns')
		expect(resolveGamePage('tango')?.slug).toBe('duo')
	})

	test('returns null for anything unregistered', () => {
		expect(resolveGamePage('checkers')).toBeNull()
		expect(resolveGamePage('')).toBeNull()
		expect(resolveGamePage('sudoku-2')).toBeNull()
	})
})

describe('requireGamePage', () => {
	test('rejects an unknown slug through notFound()', () => {
		expect(() => requireGamePage('checkers')).toThrow('NEXT_HTTP_ERROR_FALLBACK;404')
	})
})

describe('game page metadata', () => {
	test('an unknown slug is rejected by generateMetadata, not rendered as a page', async () => {
		await expect(
			generateMetadata({
				params: Promise.resolve({ locale: 'en-US', slug: 'checkers' }),
				searchParams: Promise.resolve({}),
			}),
		).rejects.toThrow('NEXT_HTTP_ERROR_FALLBACK;404')
	})
})

describe('parseGameTips', () => {
	test('keeps trimmed tips and drops blank or non-string entries', () => {
		expect(parseGameTips(['  Start with vowels  ', '', 42, null, 'Plan the ending'])).toEqual([
			'Start with vowels',
			'Plan the ending',
		])
	})

	test('returns nothing for a missing or malformed payload', () => {
		expect(parseGameTips(undefined)).toEqual([])
		expect(parseGameTips('not a list')).toEqual([])
	})
})

describe('parseGameFaq', () => {
	test('keeps complete question/answer pairs and drops malformed entries', () => {
		expect(
			parseGameFaq([
				{ question: ' Does everyone get the same puzzle? ', answer: ' Yes. ' },
				{ question: 'Missing answer' },
				{ question: '', answer: 'Orphan answer' },
				'not an object',
				{ question: 'Second?', answer: 'Second answer.' },
			]),
		).toEqual([
			{ question: 'Does everyone get the same puzzle?', answer: 'Yes.' },
			{ question: 'Second?', answer: 'Second answer.' },
		])
	})

	test('returns nothing for a missing payload', () => {
		expect(parseGameFaq(null)).toEqual([])
	})
})
