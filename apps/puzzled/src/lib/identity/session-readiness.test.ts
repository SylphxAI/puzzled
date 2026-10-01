import { describe, expect, test } from 'bun:test'
import type { IdentityUser } from './dest'
import { loadIdentitySession } from './react'

const user = { id: 'principal-fixture', email: 'fixture@example.test' } as IdentityUser

describe('session readiness independently of retention', () => {
	test('successful session loads controls even if adoption never resolves', async () => {
		let published: IdentityUser | null = null
		let loaded = false
		let adoptionStarted = false
		await loadIdentitySession(
			async () => user,
			() => true,
			(next) => {
				published = next
			},
			() => {
				loaded = true
			},
			() => {
				adoptionStarted = true
				return new Promise(() => {})
			},
		)
		expect<IdentityUser | null>(published).toBe(user)
		expect(loaded).toBe(true)
		expect(adoptionStarted).toBe(true)
	})

	test('rejected adoption cannot reset the accepted identity', async () => {
		const published: Array<IdentityUser | null> = []
		await loadIdentitySession(
			async () => user,
			() => true,
			(next) => {
				published.push(next)
			},
			() => {},
			async () => {
				throw new Error('fixture refusal')
			},
		)
		await Promise.resolve()
		expect(published).toEqual([user])
	})

	test('signed-out session is loaded and never starts adoption', async () => {
		let loaded = false
		let adopted = false
		const published: Array<IdentityUser | null> = []
		await loadIdentitySession(
			async () => null,
			() => true,
			(next) => {
				published.push(next)
			},
			() => {
				loaded = true
			},
			async () => {
				adopted = true
			},
		)
		expect(loaded).toBe(true)
		expect(published).toEqual([null])
		expect(adopted).toBe(false)
	})

	test('unmounted or changed-account session completion cannot publish or adopt', async () => {
		for (const outcome of ['success', 'failure']) {
			let current = true
			let finish!: (user: IdentityUser | null) => void
			let fail!: (error: Error) => void
			let publications = 0
			let ready = 0
			let adopted = 0
			const pending = new Promise<IdentityUser | null>((resolve, reject) => {
				finish = resolve
				fail = reject
			})
			const load = loadIdentitySession(
				() => pending,
				() => current,
				() => {
					publications++
				},
				() => {
					ready++
				},
				async () => {
					adopted++
				},
			)
			current = false
			if (outcome === 'success') finish(user)
			else fail(new Error('fixture refusal'))
			await load
			expect(publications).toBe(0)
			expect(ready).toBe(0)
			expect(adopted).toBe(0)
		}
	})
})
