export default function GameLoading() {
	return (
		<div className="flex flex-1 flex-col">
			{/* Header skeleton */}
			<div className="flex items-center justify-between border-b px-4 py-3">
				<div className="h-6 w-24 animate-pulse rounded bg-muted" />
				<div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
			</div>

			{/* Game content skeleton */}
			<main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-8">
				{/* Title skeleton */}
				<div className="text-center">
					<div className="mx-auto h-8 w-32 animate-pulse rounded bg-muted" />
					<div className="mx-auto mt-2 h-4 w-48 animate-pulse rounded bg-muted" />
				</div>

				{/* Game board skeleton - grid layout */}
				<div className="grid grid-cols-5 gap-2">
					{Array.from({ length: 30 }).map((_, i) => (
						<div key={i} className="h-12 w-12 animate-pulse rounded bg-muted" />
					))}
				</div>

				{/* Action button skeleton */}
				<div className="h-10 w-32 animate-pulse rounded-lg bg-muted" />
			</main>
		</div>
	);
}
