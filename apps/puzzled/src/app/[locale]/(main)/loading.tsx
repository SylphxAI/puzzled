export default function Loading() {
	return (
		<div className="flex flex-1 flex-col">
			{/* Header skeleton */}
			<div className="flex items-center justify-between border-b px-4 py-3">
				<div className="h-6 w-28 animate-pulse rounded bg-muted" />
				<div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
			</div>

			{/* Hero skeleton */}
			<div className="bg-gradient-to-b from-primary/5 via-primary/3 to-transparent px-4 pb-8 pt-6">
				<div className="mx-auto max-w-3xl text-center">
					<div className="mx-auto h-7 w-56 animate-pulse rounded bg-muted" />
					<div className="mx-auto mt-2 h-4 w-40 animate-pulse rounded bg-muted" />
				</div>
			</div>

			{/* Games section skeleton */}
			<div className="px-4 pb-6">
				<div className="mx-auto max-w-3xl">
					<div className="mb-4 flex items-center justify-between">
						<div className="h-5 w-32 animate-pulse rounded bg-muted" />
						<div className="h-4 w-20 animate-pulse rounded bg-muted" />
					</div>

					<div className="space-y-3">
						{[1, 2, 3].map((i) => (
							<div key={i} className="flex items-center gap-4 rounded-xl border p-4">
								<div className="h-12 w-12 animate-pulse rounded-xl bg-muted" />
								<div className="flex-1">
									<div className="h-4 w-24 animate-pulse rounded bg-muted" />
									<div className="mt-2 h-3 w-40 animate-pulse rounded bg-muted" />
								</div>
							</div>
						))}
					</div>
				</div>
			</div>

			{/* Stats section skeleton */}
			<div className="px-4 pb-8">
				<div className="mx-auto max-w-3xl">
					<div className="mb-4 h-5 w-24 animate-pulse rounded bg-muted" />
					<div className="grid grid-cols-2 gap-3">
						{[1, 2].map((i) => (
							<div key={i} className="flex items-center gap-3 rounded-xl border p-4">
								<div className="h-10 w-10 animate-pulse rounded-xl bg-muted" />
								<div>
									<div className="h-6 w-8 animate-pulse rounded bg-muted" />
									<div className="mt-1 h-3 w-16 animate-pulse rounded bg-muted" />
								</div>
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	)
}
