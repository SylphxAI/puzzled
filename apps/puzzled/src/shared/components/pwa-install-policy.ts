import { FIRST_FINISH_DAY_KEY } from '@/lib/storage-keys'

/**
 * The install offer is for someone who has already come to play: at least one
 * finished day, and a later product day than the first finish. It never
 * appears on a game page, where a board or a result may be open.
 */
export function isInstallOfferEligible(input: {
	firstFinishDay: string | null
	today: string
	pathname: string
}): boolean {
	const { firstFinishDay, today, pathname } = input
	if (!firstFinishDay) return false
	if (firstFinishDay >= today) return false
	return !/(^|\/)(games|daily)(\/|$)/.test(pathname)
}

/** Remember the first product day this browser finished a puzzle. */
export function recordFirstFinishDay(today: string): void {
	try {
		if (!window.localStorage.getItem(FIRST_FINISH_DAY_KEY)) {
			window.localStorage.setItem(FIRST_FINISH_DAY_KEY, today)
		}
	} catch {
		// Storage can be blocked; the offer then simply never appears.
	}
}

export function readFirstFinishDay(): string | null {
	try {
		return window.localStorage.getItem(FIRST_FINISH_DAY_KEY)
	} catch {
		return null
	}
}
