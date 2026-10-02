/**
 * When Puzzled Plus is offered inside the app. Pure rules: the Rust api still
 * decides access, and these only pick what the page shows, from the same
 * `PlusAccess` facts as the lock card.
 */

import { parseDismissed } from '@/features/announcements/lib/dismissed'
import { OPEN_ACCESS, type PlusAccess } from '@/lib/billing/plus'

/** Distinct play days at which a returning member is offered Plus, once each. */
export const PLUS_PROMPT_MILESTONES = [3, 7] as const

/** What a result screen needs to offer Plus: the catalogue size and the free game. */
export type PlusOffer = {
	gameCount: number
	/** Today's free featured game, the only one a free player can finish on a daily. */
	freeSlug: string
}

/** Sold and not owned: the only state in which any Plus prompt may show. */
export function plusOfferOpen(access: PlusAccess): boolean {
	return access.salesOpen && !access.entitled
}

/** The offer for a page, or null when nothing may be offered (closed, or already a member). */
export function plusOfferFor(access: PlusAccess, input: PlusOffer): PlusOffer | null {
	return plusOfferOpen(access) ? input : null
}

/** The result-screen card follows today's free game, never an archive run or a paid game. */
export function showResultPlusCard(
	offer: PlusOffer | null,
	run: { mode: 'daily' | 'archive'; gameSlug: string },
): boolean {
	return offer !== null && run.mode === 'daily' && run.gameSlug === offer.freeSlug
}

/**
 * The milestone to show: the highest one reached and not yet seen. A player
 * who jumps past day 3 straight to day 7 sees one prompt, not two.
 */
export function dueMilestone(playedDays: number, seen: readonly number[]): number | null {
	let due: number | null = null
	for (const milestone of PLUS_PROMPT_MILESTONES) {
		if (playedDays >= milestone && !seen.includes(milestone)) due = milestone
	}
	return due
}

/**
 * Fixed ids, one per milestone, kept in the existing `puzzled_dismissed_notices`
 * cookie (features/announcements/lib/dismissed.ts). No account id is stored, and
 * the server can leave a seen prompt out of the page.
 */
export const MILESTONE_IDS: Record<number, string> = {
	3: '7c1f3a52-5d0e-4b8a-9a3c-2f6e1d4b8c03',
	7: '7c1f3a52-5d0e-4b8a-9a3c-2f6e1d4b8c07',
}

/** Milestones already shown or dismissed on this browser, from the cookie value. */
export function seenMilestones(dismissedCookie: string | null | undefined): number[] {
	const ids = new Set(parseDismissed(dismissedCookie))
	return PLUS_PROMPT_MILESTONES.filter((m) => ids.has(MILESTONE_IDS[m] as string))
}

/** Showing (or dismissing) a milestone also retires every lower one. */
export function idsToRecord(milestone: number): string[] {
	return PLUS_PROMPT_MILESTONES.filter((m) => m <= milestone).map((m) => MILESTONE_IDS[m] as string)
}

/**
 * What an offer may rely on. Unlike the lock rule (which fails open so a
 * member is never locked out), an offer fails closed: when Money cannot confirm
 * the viewer is not a member, nothing is sold. `'failed'` marks a read that
 * errored.
 */
export function offerAccess(
	signedIn: boolean,
	subscription: PlusAccess | 'failed',
	plansSalesOpen: boolean | 'failed',
): PlusAccess {
	if (signedIn) return subscription === 'failed' ? OPEN_ACCESS : subscription
	if (plansSalesOpen === 'failed') return OPEN_ACCESS
	return { salesOpen: plansSalesOpen, entitled: false }
}
