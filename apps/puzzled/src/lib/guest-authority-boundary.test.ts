import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const clientPage = new URL(
	'../app/[locale]/(main)/games/[slug]/game-page-client.tsx',
	import.meta.url,
)
const serverPage = new URL('../app/[locale]/(main)/games/[slug]/page.tsx', import.meta.url)
const sessionHook = new URL('../games/shared/use-game-session.ts', import.meta.url)

describe('guest completion authority boundary', () => {
	test('does not let mutable guest storage block play without server status', () => {
		const clientSource = readFileSync(clientPage, 'utf8')
		const serverSource = readFileSync(serverPage, 'utf8')

		expect(clientSource).not.toContain('useGuestGameState')
		expect(clientSource).not.toContain('todaySession')
		expect(serverSource).toContain('getServerDailyStatus')
		expect(serverSource).not.toContain('isGuest={!user}')
	})

	test('guest projections are written only after server acceptance', () => {
		const sessionSource = readFileSync(sessionHook, 'utf8')

		expect(sessionSource).toContain("if (mode === 'daily' && !isLoggedIn && !finish.alreadyPlayed)")
		expect(sessionSource).toContain('saveGuestCompletion')
	})
})
