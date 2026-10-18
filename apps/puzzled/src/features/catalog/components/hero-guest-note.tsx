import type { ReactNode } from 'react'

type HeroGuestNoteProps = {
	/** No account on this request. */
	isGuest: boolean
	/**
	 * The game is behind Puzzled Plus for this viewer. "No account needed to
	 * play" would be untrue above the lock, so the hero says nothing then.
	 */
	locked: boolean
	children?: ReactNode
}

/** The hero's "no account needed" line for guests, absent when the board is locked. */
export function HeroGuestNote({ isGuest, locked, children }: HeroGuestNoteProps) {
	if (!isGuest || locked) return null
	return <p className="mt-3 text-sm text-[#1a1712]/75">{children}</p>
}
