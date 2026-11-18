import { describe, expect, test } from 'bun:test'
import { listPrice } from '@/features/marketing/components/catalogue-prices'
import { getAllGameMetadata } from '@/games/registry'
import { GET } from './route'

describe('/llms.txt', () => {
	test('returns a public UTF-8 plain-text document with the product and publisher distinct', async () => {
		const response = GET()
		expect(response.status).toBe(200)
		expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8')
		expect(response.headers.get('cache-control')).toBe('public, max-age=0, must-revalidate')
		const body = await response.text()
		expect(body.startsWith('# Tryit\n')).toBe(true)
		expect(body).toContain('word, logic, number and spatial puzzles, published by Sylphx Limited.')
		expect(body).not.toMatch(/Sylphx Tryit|<html|<script/i)
		expect(response.headers.has('set-cookie')).toBe(false)
	})

	test('lists only the verified public product pages, not account or API routes', async () => {
		const body = await GET().text()
		const urls = [...body.matchAll(/\]\((https:\/\/[^)]+)\)/g)].map((match) => match[1])
		expect(urls).toEqual([
			'https://tryit.fun/',
			'https://tryit.fun/games',
			'https://tryit.fun/pricing',
			...getAllGameMetadata().map((game) => `https://tryit.fun/games/${game.slug}`),
			'https://tryit.fun/leaderboard',
			'https://tryit.fun/use-cases/daily-word-and-logic-puzzles-online',
			'https://tryit.fun/use-cases/family-brain-games-no-ads',
			'https://tryit.fun/vs/nyt-games',
			'https://tryit.fun/support',
			'https://tryit.fun/privacy',
			'https://tryit.fun/terms',
		])
		expect(new Set(urls).size).toBe(urls.length)
		for (const game of getAllGameMetadata()) {
			expect(body).toContain(
				`[${game.name}](https://tryit.fun/games/${game.slug}): ${game.description}`,
			)
		}
		expect(body.trimEnd().endsWith('Contact: hi@tryit.fun.')).toBe(true)
	})

	test('states the free daily picks and the catalogue prices players are charged', async () => {
		const body = await GET().text()
		const total = getAllGameMetadata().length
		expect(body).toContain(
			`Pick any 3 of today's ${total} games to play free every day, no account needed.`,
		)
		expect(body).not.toMatch(/featured puzzle is free|one featured/i)
		expect(body).toContain(`A one-time 3-Day Pass (${listPrice('puzzled_starter_unlock')} USD`)
		expect(body).toContain(
			`Tryit Plus (${listPrice('plus_individual_monthly')}/mo or ${listPrice('plus_individual_yearly')}/yr USD`,
		)
		expect(body).toContain(
			`(${listPrice('plus_family_monthly')}/mo or ${listPrice('plus_family_yearly')}/yr USD`,
		)
		expect(body).not.toMatch(/Sylphx Money|Keel|Spiron/)
	})
})
