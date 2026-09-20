/**
 * Archive admission (G2) — what the index may render for this request.
 *
 * Fail closed, in one place so it can be asserted directly:
 *
 * - no account            -> `guest`  (sign in; the archive is per-identity)
 * - an account, no Plus   -> `locked` (upgrade; archive is a PUZ-PLUS surface)
 * - an account with Plus  -> `open`   (the day list)
 *
 * An entitlement read that could not be verified arrives here as `false`
 * (`readArchiveEntitlement` below resolves it), so an unavailable Commerce
 * answer is `locked`, never `open` — the same fail-closed direction the kernel
 * uses, and the one `docs/north-star/MONETIZATION.md` requires
 * ("fail-closed to free on uncertainty").
 */

import { SERVER_CONNECT_TIMEOUT_MS } from '@/lib/api/connect-fetch'

export type ArchiveAccess = 'guest' | 'locked' | 'open'

export function archiveAccess(input: { hasUser: boolean; isPremium: boolean }): ArchiveAccess {
	if (!input.hasUser) return 'guest'
	return input.isPremium ? 'open' : 'locked'
}

/**
 * The archive's entitlement read — fail closed, in one asserted place.
 *
 * Only the boolean `true` counts as entitled. A Commerce read that rejects, one
 * that never answers inside the presentation deadline, and any non-boolean
 * answer all resolve `false`, which `archiveAccess` renders as `locked`: an
 * unavailable billing answer must not open the day list.
 *
 * `readPremium` is injectable so the direction is asserted by test instead of
 * assumed from the call site, which passes `hasPremiumAccess`.
 */
export async function readArchiveEntitlement(
	userId: string,
	readPremium: (userId: string) => Promise<unknown>,
	timeoutMs: number = SERVER_CONNECT_TIMEOUT_MS,
): Promise<boolean> {
	let timer: ReturnType<typeof setTimeout> | undefined
	try {
		const answer = await Promise.race([
			readPremium(userId),
			new Promise<undefined>((resolve) => {
				timer = setTimeout(() => resolve(undefined), timeoutMs)
			}),
		])
		return answer === true
	} catch {
		return false
	} finally {
		if (timer !== undefined) clearTimeout(timer)
	}
}

/**
 * The index's whole admission for one request: the identity, the verified
 * entitlement, and the three-way answer.
 *
 * The page supplies only what it fetched (`currentUser()` and
 * `hasPremiumAccess`), so guest, unentitled and entitled all resolve here and
 * are asserted by test rather than assembled inline in a server component.
 */
export async function resolveArchiveAccess(input: {
	/** The signed-in account id, or null/undefined for a guest. */
	userId?: string | null
	readPremium: (userId: string) => Promise<unknown>
}): Promise<ArchiveAccess> {
	const userId = input.userId ?? null
	if (!userId) return 'guest'
	return archiveAccess({
		hasUser: true,
		isPremium: await readArchiveEntitlement(userId, input.readPremium),
	})
}
