import { describe, expect, test } from 'bun:test'
import { addDismissed, parseDismissed, serializeDismissedCookie } from './dismissed'
import { type BannerAnnouncement, visibleAnnouncements } from './visible'

const A = '0197a000-0000-7000-8000-000000000001'
const B = '0197a000-0000-7000-8000-000000000002'

const item = (id: string, dismissible = true): BannerAnnouncement => ({
	id,
	title: 'T',
	body: 'B',
	type: 'info',
	dismissible,
})

describe('dismissed announcements cookie', () => {
	test('round-trips ids, ignores junk and empty values', () => {
		expect(parseDismissed(undefined)).toEqual([])
		expect(parseDismissed('')).toEqual([])
		expect(parseDismissed(`${A}.not-an-id.${B}`)).toEqual([A, B])
	})

	test('adding is idempotent, keeps the newest and caps the list', () => {
		expect(addDismissed([A], A)).toEqual([A])
		expect(addDismissed([A], B)).toEqual([A, B])
		expect(addDismissed([A], 'bogus')).toEqual([A])
		const many = Array.from(
			{ length: 25 },
			(_, i) => `0197a000-0000-7000-8000-${String(i).padStart(12, '0')}`,
		)
		const capped = many.reduce<string[]>((acc, id) => addDismissed(acc, id), [])
		expect(capped).toHaveLength(20)
		expect(capped.at(-1)).toBe(many.at(-1))
	})

	test('the cookie is first-party, site-wide, SameSite and Secure over https', () => {
		const https = serializeDismissedCookie([A], true)
		expect(https).toContain('Path=/')
		expect(https).toContain('SameSite=Lax')
		expect(https).toContain('Secure')
		expect(https).not.toContain('HttpOnly')
		expect(serializeDismissedCookie([A], false)).not.toContain('Secure')
	})

	test('a dismissed notice is left out; one that cannot be dismissed stays', () => {
		expect(visibleAnnouncements([item(A), item(B)], A).map((i) => i.id)).toEqual([B])
		expect(visibleAnnouncements([item(A, false)], A).map((i) => i.id)).toEqual([A])
		expect(visibleAnnouncements([], A)).toEqual([])
		expect(visibleAnnouncements([item(A)], null)).toHaveLength(1)
	})

	test('a cached item whose end has passed is never shown, dismissed or not', () => {
		const now = Date.parse('2026-10-31T00:00:00Z')
		const ended = { ...item(A), endsAt: '2026-10-30T23:59:59Z' }
		const edge = { ...item(B), endsAt: '2026-10-31T00:00:00Z' }
		const open = { ...item('0197a000-0000-7000-8000-000000000003'), endsAt: '' }
		const live = { ...item('0197a000-0000-7000-8000-000000000004'), endsAt: '2026-11-01T00:00:00Z' }
		expect(visibleAnnouncements([ended, edge, open, live], null, now).map((i) => i.id)).toEqual([
			open.id,
			live.id,
		])
		expect(visibleAnnouncements([{ ...item(A, false), endsAt: ended.endsAt }], null, now)).toEqual(
			[],
		)
	})
})
