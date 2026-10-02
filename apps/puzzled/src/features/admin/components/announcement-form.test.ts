import { describe, expect, test } from 'bun:test'
import { type AnnouncementFormData, toAnnouncementRequest, toLocalInput } from './announcement-form'

const form: AnnouncementFormData = {
	title: 'T',
	content: 'Body',
	type: 'warning',
	isActive: true,
	dismissible: false,
	startsAt: '2026-10-05T09:30',
	endsAt: '',
}

describe('announcement editor request', () => {
	test('uses the Connect field names and carries no targeting flags', () => {
		const body = toAnnouncementRequest(form)
		expect(Object.keys(body).sort()).toEqual(
			['active', 'body', 'dismissible', 'endsAt', 'startsAt', 'title', 'type'].sort(),
		)
		expect(body).toMatchObject({
			title: 'T',
			body: 'Body',
			type: 'warning',
			active: true,
			dismissible: false,
		})
		expect(body.endsAt).toBeUndefined()
		expect(body.startsAt).toBe(new Date('2026-10-05T09:30').toISOString())
	})

	test('the editor no longer offers premium-only or show-once', async () => {
		const source = await Bun.file(new URL('./announcement-editor.tsx', import.meta.url)).text()
		for (const gone of ['targetPremiumOnly', 'targetAllUsers', 'showOnce', 'premiumOnly']) {
			expect(source).not.toContain(gone)
		}
	})
})

describe('announcement editor window round trip', () => {
	test('empty maps to empty', () => {
		expect(toLocalInput(null)).toBe('')
		expect(toLocalInput(undefined)).toBe('')
	})

	// The zone is fixed per process, so each zone runs in its own.
	for (const tz of ['America/New_York', 'Asia/Kolkata', 'Pacific/Auckland', 'UTC']) {
		test(`load then save keeps the instant in ${tz}`, () => {
			const script = `
				import { toLocalInput, toAnnouncementRequest } from ${JSON.stringify(new URL('./announcement-form.ts', import.meta.url).pathname)}
				const stored = new Date('2026-10-05T01:30:00.000Z')
				const input = toLocalInput(stored)
				const out = toAnnouncementRequest({ title: 't', content: 'c', type: 'info', isActive: true, dismissible: true, startsAt: input, endsAt: '' })
				console.log(JSON.stringify({ input, startsAt: out.startsAt, offset: stored.getTimezoneOffset() }))`
			const run = Bun.spawnSync([process.execPath, '-e', script], {
				env: { ...process.env, TZ: tz },
			})
			expect(run.exitCode).toBe(0)
			const got = JSON.parse(run.stdout.toString().trim().split('\n').pop() as string)
			expect(got.startsAt).toBe('2026-10-05T01:30:00.000Z')
			// the field shows the admin's wall clock, not UTC (unless the zone is UTC)
			if (tz === 'UTC') expect(got.input).toBe('2026-10-05T01:30')
			else expect(got.input).not.toBe('2026-10-05T01:30')
		})
	}
})
