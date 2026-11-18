import { Play } from 'lucide-react'

type HeroPlayActionProps = {
	/**
	 * The game or day is behind Tryit Plus for this viewer. The unlock panel
	 * below then owns the one action ("Play {game} free"), so the hero offers none.
	 */
	locked: boolean
	label: string
	/** Today's started board (one tap to play), or `#play` for an archive day. */
	href: string
	/** The game slug: the press is the explicit start, so the board opens at once. */
	startIntent?: string
}

/** The hero's play button: opens the board, absent when the board is locked. */
export function HeroPlayAction({ locked, label, href, startIntent }: HeroPlayActionProps) {
	if (locked) return null
	return (
		<div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
			<a
				href={href}
				data-start-intent={href.includes('start=1') ? startIntent : undefined}
				className="pressable inline-flex h-12 items-center gap-2 rounded-xl border-[1.5px] border-[#1a1712] bg-cta px-7 text-[16px] font-bold text-cta-foreground shadow-[0_3px_0_0_#1a1712] transition-colors hover:bg-cta-hover active:translate-y-0.5 active:shadow-[0_1px_0_0_#1a1712]"
			>
				<Play className="h-4 w-4" fill="currentColor" aria-hidden="true" />
				{label}
			</a>
		</div>
	)
}
