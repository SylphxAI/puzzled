import { describe, expect, test } from 'bun:test'
import { buildWebVitalsEvent, createWebVitalsBatch, type WebVitalRecord } from './web-vitals-batch'

const METRICS: WebVitalRecord[] = [
	{
		name: 'LCP',
		value: 1839.4,
		rating: 'good',
		delta: 1839.4,
		id: 'v5-1',
		navigationType: 'navigate',
	},
	{ name: 'INP', value: 176, rating: 'good', delta: 176, id: 'v5-2', navigationType: 'navigate' },
	{
		name: 'CLS',
		value: 0.026,
		rating: 'good',
		delta: 0.026,
		id: 'v5-3',
		navigationType: 'navigate',
	},
	{ name: 'FCP', value: 1090, rating: 'good', delta: 1090, id: 'v5-4', navigationType: 'navigate' },
	{ name: 'TTFB', value: 638, rating: 'good', delta: 638, id: 'v5-5', navigationType: 'navigate' },
]

/** Local sink: records what the transport would have sent. */
function sink() {
	const bodies: string[] = []
	return { bodies, deliver: (body: string) => bodies.push(body) }
}

describe('web vitals batch', () => {
	test('records nothing and delivers nothing without consent', () => {
		const out = sink()
		const batch = createWebVitalsBatch({ isAllowed: () => false, deliver: out.deliver })

		for (const metric of METRICS) batch.record(metric)

		expect(batch.size()).toBe(0)
		expect(batch.flush()).toBe(false)
		expect(out.bodies).toEqual([])
	})

	test('delivers one request per page view carrying every metric', () => {
		const out = sink()
		const batch = createWebVitalsBatch({ isAllowed: () => true, deliver: out.deliver })

		for (const metric of METRICS) batch.record(metric)
		expect(batch.size()).toBe(5)

		expect(batch.flush()).toBe(true)
		expect(out.bodies).toHaveLength(1)

		const payload = JSON.parse(out.bodies[0] as string)
		expect(payload.event).toBe('web_vital')
		expect(payload.properties.metric_count).toBe(5)
		expect(payload.properties.lcp_value).toBe(1839.4)
		expect(payload.properties.inp_value).toBe(176)
		expect(payload.properties.cls_value).toBe(0.026)
		expect(payload.properties.fcp_value).toBe(1090)
		expect(payload.properties.ttfb_value).toBe(638)
		expect(payload.properties.navigation_type).toBe('navigate')
		// Pre-batching keys survive for the primary metric (LCP here).
		expect(payload.properties.metric_name).toBe('LCP')
		expect(payload.properties.value).toBe(1839.4)
		expect(payload.properties.rating).toBe('good')
		expect(payload.properties.id).toBe('v5-1')
	})

	test('falls back to the last metric for the legacy keys when there is no LCP', () => {
		const out = sink()
		const batch = createWebVitalsBatch({ isAllowed: () => true, deliver: out.deliver })
		batch.record(METRICS[3] as WebVitalRecord) // FCP
		batch.record(METRICS[4] as WebVitalRecord) // TTFB, recorded last
		batch.flush()

		const payload = JSON.parse(out.bodies[0] as string)
		expect(payload.properties.metric_name).toBe('TTFB')
		expect(payload.properties.value).toBe(638)
		expect(payload.properties.metric_count).toBe(2)
	})

	test('one page view never sends twice, and later metrics are not queued', () => {
		const out = sink()
		const batch = createWebVitalsBatch({ isAllowed: () => true, deliver: out.deliver })

		batch.record(METRICS[0] as WebVitalRecord)
		batch.flush()
		batch.record(METRICS[1] as WebVitalRecord)

		expect(batch.flush()).toBe(false)
		expect(out.bodies).toHaveLength(1)
	})

	test('consent revoked before delivery drops the buffered metrics', () => {
		const out = sink()
		let allowed = true
		const batch = createWebVitalsBatch({ isAllowed: () => allowed, deliver: out.deliver })

		for (const metric of METRICS) batch.record(metric)
		allowed = false

		expect(batch.flush()).toBe(false)
		expect(out.bodies).toEqual([])
		expect(batch.size()).toBe(0)
	})

	test('the latest value of a re-reported metric wins', () => {
		const out = sink()
		const batch = createWebVitalsBatch({ isAllowed: () => true, deliver: out.deliver })

		batch.record({ ...(METRICS[0] as WebVitalRecord), value: 1000, delta: 1000 })
		batch.record({ ...(METRICS[0] as WebVitalRecord), value: 2500, delta: 1500 })
		batch.flush()

		const payload = JSON.parse(out.bodies[0] as string)
		expect(payload.properties.lcp_value).toBe(2500)
		expect(payload.properties.lcp_delta).toBe(1500)
		expect(payload.properties.metric_count).toBe(1)
	})

	test('event shape stays flat key/value pairs for the authority', () => {
		const event = buildWebVitalsEvent(METRICS)
		for (const value of Object.values(event.properties)) {
			expect(['string', 'number']).toContain(typeof value)
		}
	})
})
