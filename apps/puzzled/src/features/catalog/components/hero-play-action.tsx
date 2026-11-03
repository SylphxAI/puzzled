import { Play } from 'lucide-react'

type HeroPlayActionProps = {
	/**
	 * The game or day is behind Puzzled Plus for this viewer. The unlock panel
	 * below then owns the one action ("Play {game} free"), so the hero offers none.
	 */
	locked: boolean
	label: string
	/** Today's started board (one tap to play), or `#play` for an archive day. */
	href: string
}

/** The hero's play button: opens the board, absent when the board is locked. */
export function HeroPlayAction({ locked, label, href }: HeroPlayActionProps) {
	if (locked) return null
	return (
		<div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
			<a
				href={href}
				className="pressable inline-flex h-12 items-center gap-2 rounded-full bg-[#1a1712] px-7 text-[16px] font-semibold text-[#fbf9f4] transition-opacity hover:opacity-90"
			>
				<Play className="h-4 w-4" fill="currentColor" aria-hidden="true" />
				{label}
			</a>
		</div>
	)
}
