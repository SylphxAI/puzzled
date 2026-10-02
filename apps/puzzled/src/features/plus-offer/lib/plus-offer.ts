/**
 * When Puzzled Plus is offered inside the app. Pure rules: the Rust api still
 * decides access, and these only pick what the page shows, from the same
 * `PlusAccess` facts as the lock card.
 */

import type { PlusAccess } from '@/lib/billing/plus'

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

/** Showing (or dismissing) a milestone also retires every lower one. */
export function markSeen(seen: readonly number[], milestone: number): number[] {
	const next = new Set(seen)
	for (const m of PLUS_PROMPT_MILESTONES) if (m <= milestone) next.add(m)
	return [...next].sort((a, b) => a - b)
}

/** Parse the stored list; anything malformed reads as "nothing seen". */
export function parseSeen(raw: string | null): number[] {
	if (!raw) return []
	try {
		const value: unknown = JSON.parse(raw)
		if (!Array.isArray(value)) return []
		return value.filter((v): v is number => typeof v === 'number' && Number.isInteger(v))
	} catch {
		return []
	}
}

/** One key per account on this browser; signed-out browsers share one. */
export function seenStorageKey(userId: string | null): string {
	return `puzzled:plus-prompt:v1:${userId ?? 'browser'}`
}
