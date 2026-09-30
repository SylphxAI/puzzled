import { describe, expect, test } from 'bun:test'
import { NextRequest } from 'next/server'
import { proxy } from '../../proxy'
import {
	LEGACY_SESSION_COOKIE,
	legacySessionToMigrate,
	readSessionToken,
	SESSION_COOKIE,
	SESSION_COOKIE_NAMES,
} from './session-cookie'

function jar(values: Record<string, string>) {
	return { get: (name: string) => (name in values ? { value: values[name] as string } : undefined) }
}

function request(cookie: string) {
	return new NextRequest('https://puzzled.gg/games', { headers: { cookie } })
}

describe('session cookie rename', () => {
	test('the new cookie works and wins over the old one', () => {
		expect(readSessionToken(jar({ [SESSION_COOKIE]: 'new' }))).toBe('new')
		expect(readSessionToken(jar({ [SESSION_COOKIE]: 'new', [LEGACY_SESSION_COOKIE]: 'old' }))).toBe(
			'new',
		)
		expect(legacySessionToMigrate(jar({ [SESSION_COOKIE]: 'new' }))).toBeUndefined()
		expect(
			legacySessionToMigrate(jar({ [SESSION_COOKIE]: 'new', [LEGACY_SESSION_COOKIE]: 'old' })),
		).toBeUndefined()
	})

	test('an old-cookie request stays signed in', () => {
		expect(readSessionToken(jar({ [LEGACY_SESSION_COOKIE]: 'old' }))).toBe('old')
		expect(legacySessionToMigrate(jar({ [LEGACY_SESSION_COOKIE]: 'old' }))).toBe('old')
		expect(readSessionToken(jar({}))).toBeUndefined()
	})

	test('the proxy re-sets an old cookie under the new name and expires the old one', async () => {
		const response = await proxy(request(`${LEGACY_SESSION_COOKIE}=old-token`))
		expect(response.cookies.get(SESSION_COOKIE)?.value).toBe('old-token')
		const expired = response.cookies.get(LEGACY_SESSION_COOKIE)
		expect(expired?.value).toBe('')
	})

	test('sign-out clears both names', () => {
		expect([...SESSION_COOKIE_NAMES]).toEqual([SESSION_COOKIE, LEGACY_SESSION_COOKIE])
	})

	test('the proxy leaves a new-cookie request alone', async () => {
		const response = await proxy(request(`${SESSION_COOKIE}=new-token`))
		expect(response.cookies.get(SESSION_COOKIE)).toBeUndefined()
		expect(response.cookies.get(LEGACY_SESSION_COOKIE)).toBeUndefined()
	})
})
