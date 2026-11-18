/**
 * Streaming placeholder for the play area.
 *
 * `stage` (the player pressed Play) has the start card's shape; `landing`
 * (the game's own page) keeps the height a board or level list usually
 * takes, so the rules and FAQ below do not jump when it lands.
 *
 * The skeleton lives inside the page (not in a route `loading.tsx`) so the
 * registry guard in `page.tsx` still runs before any boundary can flush a 200
 * shell for a slug that does not exist.
 */
export function GamePlaySkeleton({ variant = 'landing' }: { variant?: 'landing' | 'stage' }) {
	if (variant === 'stage') {
		return (
			<div
				className="mx-auto w-full max-w-xl overflow-hidden rounded-[1.125rem] border border-border bg-card"
				aria-busy="true"
			>
				<div className="aspect-[16/7] animate-pulse bg-muted" />
				<div className="flex flex-col items-center gap-3 px-5 pb-5 pt-4">
					<div className="h-14 w-full max-w-sm animate-pulse rounded-xl bg-muted" />
					<div className="h-4 w-64 animate-pulse rounded bg-muted" />
				</div>
			</div>
		)
	}
	return (
		<div className="flex min-h-[24rem] flex-col items-center gap-5 py-6" aria-busy="true">
			<div className="h-14 w-full max-w-2xl animate-pulse rounded-[1.125rem] bg-muted" />
			<div className="grid grid-cols-5 gap-2">
				{Array.from({ length: 20 }).map((_, index) => (
					<div key={index} className="h-11 w-11 animate-pulse rounded-lg bg-muted" />
				))}
			</div>
		</div>
	)
}
