/**
 * Batched Web Vitals payloads.
 *
 * The page view is the unit of delivery: every Core Web Vital plus FCP/TTFB is
 * collected into one `web_vital` event and delivered in a single request when
 * the page is hidden, instead of one POST per metric. Values are flat
 * `<metric>_value|_delta|_rating|_id` properties because
 * `/api/observability/analytics` forwards properties as `{key, string_value}`
 * pairs to the observability authority.
 *
 * The single-event shape also keeps the pre-batching keys (`metric_name`,
 * `value`, `rating`, `delta`, `id`, `navigation_type`) for one primary metric —
 * LCP when present, otherwise the last one recorded — so a consumer that reads
 * those keys keeps seeing a value while the per-metric keys are adopted.
 *
 * Consent is checked when a metric is recorded *and* again when the batch is
 * delivered, so a revocation drops anything still buffered and nothing is
 * reported before an explicit opt-in.
 */

export type WebVitalRecord = {
	name: string
	value: number
	rating: string
	delta: number
	id: string
	navigationType?: string
}

export type WebVitalsEvent = {
	event: 'web_vital'
	properties: Record<string, string | number>
}

/** Metric value rounding: sub-millisecond precision is noise at p75. */
function round(value: number): number {
	return Math.round(value * 1000) / 1000
}

export function buildWebVitalsEvent(records: readonly WebVitalRecord[]): WebVitalsEvent {
	const properties: Record<string, string | number> = { metric_count: records.length }
	for (const record of records) {
		const prefix = record.name.toLowerCase()
		properties[`${prefix}_value`] = round(record.value)
		properties[`${prefix}_rating`] = record.rating
		properties[`${prefix}_delta`] = round(record.delta)
		properties[`${prefix}_id`] = record.id
		if (record.navigationType) {
			properties[`${prefix}_navigation_type`] = record.navigationType
		}
	}
	// Top-level navigation type is the same for every metric of a page view.
	const navigationType = records.find((record) => record.navigationType)?.navigationType
	if (navigationType) {
		properties.navigation_type = navigationType
	}

	// Pre-batching shape, kept for compatibility with existing consumers.
	const primary = records.find((record) => record.name === 'LCP') ?? records[records.length - 1]
	if (primary) {
		properties.metric_name = primary.name
		properties.value = round(primary.value)
		properties.rating = primary.rating
		properties.delta = round(primary.delta)
		properties.id = primary.id
	}
	return { event: 'web_vital', properties }
}

export type WebVitalsBatch = {
	/** Buffer a metric for this page view. No-op without consent, or after flush. */
	record: (record: WebVitalRecord) => void
	/** Deliver the buffered metrics as one request. At most one per page view. */
	flush: () => boolean
	/** Metrics currently buffered. */
	size: () => number
}

export function createWebVitalsBatch(options: {
	/** Consent gate; re-checked at delivery time. */
	isAllowed: () => boolean
	/** Transport for the serialized body. */
	deliver: (body: string) => void
}): WebVitalsBatch {
	const collected = new Map<string, WebVitalRecord>()
	let delivered = false

	return {
		record(record) {
			if (delivered) return
			if (!options.isAllowed()) return
			// Web Vitals re-reports a metric as it grows: keep the latest value.
			collected.set(record.name, record)
		},
		flush() {
			if (delivered || collected.size === 0) return false
			if (!options.isAllowed()) {
				collected.clear()
				return false
			}
			const records = [...collected.values()]
			collected.clear()
			delivered = true
			options.deliver(JSON.stringify(buildWebVitalsEvent(records)))
			return true
		},
		size() {
			return collected.size
		},
	}
}
