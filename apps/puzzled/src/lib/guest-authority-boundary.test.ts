import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const clientPage = new URL(
	'../app/[locale]/(main)/games/[slug]/game-page-client.tsx',
	import.meta.url,
)
const serverPage = new URL('../app/[locale]/(main)/games/[slug]/page.tsx', import.meta.url)
const sessionHook = new URL('../games/shared/use-game-session.ts', import.meta.url)
const identity = new URL(
	'../../../../crates/puzzled-server/src/bootstrap/identity.rs',
	import.meta.url,
)
const sessions = new URL(
	'../../../../crates/puzzled-server/src/capabilities/puzzle_play/adapters/game_sessions_db.rs',
	import.meta.url,
)
const bootstrap = new URL(
	'../features/daily/components/guest-identity-bootstrap.tsx',
	import.meta.url,
)
const guestDayId = new URL('./guest-day-id.ts', import.meta.url)

describe('guest completion authority boundary', () => {
	test('does not let mutable guest storage block play without server status', () => {
		const clientSource = readFileSync(clientPage, 'utf8')
		const serverSource = readFileSync(serverPage, 'utf8')

		expect(clientSource).not.toContain('useGuestGameState')
		expect(clientSource).not.toContain('todaySession')
		expect(serverSource).toContain('getServerDailyStatus')
		expect(serverSource).toContain('hasCompletedToday && !completedSession')
		expect(serverSource).not.toMatch(/user \? getServerDailyStatus/)
		expect(serverSource).not.toContain('getServerTodaysPuzzle')
		expect(serverSource).toContain('getServerDailyStatus({ gameSlug: slug, difficulty })')
	})

	test('guest SSR identity cookie is written for existing localStorage ids', () => {
		const bootstrapSource = readFileSync(bootstrap, 'utf8')
		const guestDayIdSource = readFileSync(guestDayId, 'utf8')

		expect(bootstrapSource).toContain('getOrCreateGuestDayId')
		expect(bootstrapSource).toContain('readGuestIdCookie')
		expect(bootstrapSource).toContain('router.refresh()')
		expect(guestDayIdSource).toMatch(
			/if \(existing && UUID_RE\.test\(existing\)\)[\s\S]*persistGuestIdCookie\(existing\)/,
		)
	})

	test('guest projections are written only after server acceptance', () => {
		const sessionSource = readFileSync(sessionHook, 'utf8')

		expect(sessionSource).toContain('saveGuestCompletion')
		expect(sessionSource).toMatch(
			/if \(requireServerAccept && !finish\.success\)[\s\S]*return finish[\s\S]*saveGuestCompletion/,
		)
	})

	test('platform identity keeps the guest id for adoption without a second finish', () => {
		const identitySource = readFileSync(identity, 'utf8')
		const sessionSource = readFileSync(sessions, 'utf8')

		expect(identitySource).toContain('fn adoption_pair')
		expect(identitySource).toContain('platform.user_id != guest.user_id')
		expect(sessionSource).toContain('pub async fn adopt_guest_sessions')
		expect(sessionSource).toContain('ADOPT_GUEST_COLLISION_DELETE_SQL')
		expect(sessionSource).toContain('ADOPT_GUEST_REASSIGN_SQL')
	})
})
