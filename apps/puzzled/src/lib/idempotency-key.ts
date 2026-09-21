/**
 * Client-minted idempotency keys for the ritual-finish write path (TD-19).
 *
 * The one-finish-per-(user, module, product day) guard is a Postgres partial
 * unique index (apps/puzzled/atlas/migrations/20260812010000_ritual_one_finish_per_day.sql).
 * A retry that lands after the first write committed is interpretable today
 * only because the server maps the unique violation to `already_played` and the
 * client treats that as an accepted finish. Naming the submission intent on the
 * wire makes the duplicate explicit, so a server-side consumer can replay the
 * accepted result instead of inferring it from an index violation.
 *
 * One key per submission intent: `useSaveResult` stamps the submission
 * variables once per save call, and the automatic mutation retry
 * (`lib/api/provider.tsx` `mutations.retry = 1`) re-runs the mutation with the
 * SAME variables — so a retry-after-timeout carries the same key, while a
 * later finish mints a new one.
 */

/** Request header for SubmitGuess idempotency (companion to X-Puzzled-Guest-Id). */
export const IDEMPOTENCY_KEY_HEADER = 'X-Puzzled-Idempotency-Key'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Mint a fresh submission key (UUID v4). */
export function mintIdempotencyKey(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID()
	}
	// Fallback for non-secure contexts / older runtimes (guest-day-id pattern).
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
		const r = (Math.random() * 16) | 0
		const v = c === 'x' ? r : (r & 0x3) | 0x8
		return v.toString(16)
	})
}

/** True when `value` is UUID-shaped (what `mintIdempotencyKey` returns). */
export function isIdempotencyKey(value: string): boolean {
	return UUID_RE.test(value)
}

/**
 * Stamp submission variables with one idempotency key per intent. Idempotent:
 * an already-stamped payload keeps its key, so re-issuing the same variables
 * (a retry) never re-mints.
 */
export function withIdempotencyKey<T>(
	input: T & { idempotencyKey?: string },
): T & { idempotencyKey: string } {
	const existing = input.idempotencyKey?.trim()
	if (existing) return { ...input, idempotencyKey: existing }
	return { ...input, idempotencyKey: mintIdempotencyKey() }
}
