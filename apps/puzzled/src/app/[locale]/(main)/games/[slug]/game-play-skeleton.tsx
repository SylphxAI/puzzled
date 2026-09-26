/**
 * Streaming placeholder for the play area.
 *
 * The skeleton lives inside the page (not in a route `loading.tsx`) so the
 * registry guard in `page.tsx` still runs before any boundary can flush a 200
 * shell for a slug that does not exist.
 */
export function GamePlaySkeleton() {
	return (
		<div className="flex min-h-[32rem] flex-col items-center gap-6 py-10" aria-busy="true">
			<div className="text-center">
				<div className="mx-auto h-8 w-32 animate-pulse rounded bg-muted" />
				<div className="mx-auto mt-2 h-4 w-48 animate-pulse rounded bg-muted" />
			</div>

			<div className="grid grid-cols-5 gap-2">
				{Array.from({ length: 30 }).map((_, index) => (
					<div key={index} className="h-12 w-12 animate-pulse rounded bg-muted" />
				))}
			</div>

			<div className="h-10 w-32 animate-pulse rounded-lg bg-muted" />
		</div>
	)
}
