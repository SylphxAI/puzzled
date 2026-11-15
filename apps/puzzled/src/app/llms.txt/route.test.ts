import { describe, expect, test } from 'bun:test'
import { getAllGameMetadata } from '@/games/registry'
import { GET } from './route'

describe('/llms.txt', () => {
	test('returns a public UTF-8 plain-text document with the product and publisher distinct', async () => {
		const response = GET()
		expect(response.status).toBe(200)
		expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8')
		const body = await response.text()
		expect(body.startsWith('# Puzzled\n')).toBe(true)
		expect(body).toContain('word, logic, number and spatial puzzles, published by Sylphx Limited.')
		expect(body).not.toMatch(/Sylphx Puzzled|<html|<script/i)
		expect(response.headers.has('set-cookie')).toBe(false)
	})

	test('lists only the verified public product pages, not account or API routes', async () => {
		const body = await GET().text()
		const urls = [...body.matchAll(/\]\((https:\/\/[^)]+)\)/g)].map((match) => match[1])
		expect(urls).toEqual([
			'https://puzzled.gg/',
			'https://puzzled.gg/games',
			'https://puzzled.gg/pricing',
			...getAllGameMetadata().map((game) => `https://puzzled.gg/games/${game.slug}`),
			'https://puzzled.gg/leaderboard',
			'https://puzzled.gg/use-cases/daily-word-and-logic-puzzles-online',
			'https://puzzled.gg/use-cases/family-brain-games-no-ads',
			'https://puzzled.gg/support',
			'https://puzzled.gg/privacy',
			'https://puzzled.gg/terms',
		])
		expect(new Set(urls).size).toBe(urls.length)
		for (const game of getAllGameMetadata()) {
			expect(body).toContain(
				`[${game.name}](https://puzzled.gg/games/${game.slug}): ${game.description}`,
			)
		}
		expect(body.trimEnd().endsWith('Contact: hi@puzzled.gg.')).toBe(true)
	})
})
