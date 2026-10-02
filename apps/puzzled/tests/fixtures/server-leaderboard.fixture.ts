// Isolated process: Next request mocks must never affect other unit tests.
import { mock } from 'bun:test'
import { AsyncLocalStorage } from 'node:async_hooks'
import { once } from 'node:events'
import { createServer } from 'node:http'

const contexts = new AsyncLocalStorage<{ cookie: string; userAgent: string }>()
mock.module('server-only', () => ({}))
mock.module('next/headers', () => ({
	cookies: async () => {
		const cookie = contexts.getStore()?.cookie ?? ''
		const all = cookie
			? cookie.split('; ').map((item) => {
					const [name, ...value] = item.split('=')
					return { name: name ?? '', value: value.join('=') }
				})
			: []
		return {
			toString: () => cookie,
			getAll: () => all,
			get: (name: string) => all.find((item) => item.name === name),
		}
	},
	headers: async () => new Headers({ 'user-agent': contexts.getStore()?.userAgent ?? '' }),
}))
const received: { cookie: string; userAgent: string; path: string }[] = []
const server = createServer((request, response) => {
	const cookie = request.headers.cookie ?? ''
	const userAgent = request.headers['user-agent'] ?? ''
	received.push({ cookie, userAgent, path: request.url ?? '' })
	response.setHeader('content-type', 'application/json')
	response.end(
		JSON.stringify({
			entries: ['A', 'B'].map((name, index) => ({
				rank: index + 1,
				userId: `entry-${received.length}-${index}`,
				userName: name,
				value: 100 - index,
				isViewer: cookie === `puzzled_session=${name}` && userAgent === `Browser-${name}`,
			})),
		}),
	)
})
server.listen(0, '127.0.0.1')
await once(server, 'listening')
const address = server.address()
if (!address || typeof address === 'string') throw new Error('no test port')
process.env.SKIP_ENV_VALIDATION = 'true'
process.env.API_INTERNAL_URL = `http://127.0.0.1:${address.port}`
try {
	const { getServerLeaderboard } = await import('../../src/lib/api/server')
	const input = { gameSlug: 'sudoku', type: 'score', period: 'all', limit: 10 } as const
	const readers = [
		{ cookie: 'puzzled_session=A', userAgent: 'Browser-A' },
		{ cookie: 'puzzled_session=B', userAgent: 'Browser-B' },
		{ cookie: '', userAgent: 'Browser-anonymous' },
	]
	const boards = await Promise.all(
		readers.map((context) =>
			contexts.run(context, async () =>
				(await getServerLeaderboard(input)).entries.map((entry) => entry.isViewer),
			),
		),
	)
	const again = await contexts.run(readers[0]!, async () =>
		(await getServerLeaderboard(input)).entries.map((entry) => entry.isViewer),
	)
	console.log(JSON.stringify({ boards, again, received }))
} finally {
	server.closeAllConnections()
	server.close()
}
