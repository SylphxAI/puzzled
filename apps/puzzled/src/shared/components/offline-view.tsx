import { Button } from '@sylphx/ui'
import { RefreshCw, WifiOff } from 'lucide-react'
import { BrandMark, Wordmark } from './brand/mark'

/** Rendered to a standalone document: no hydration, account reads or puzzle data. */
export type OfflineLabels = { title: string; description: string; retry: string }

export function OfflineView({
	labels,
	homeHref = '/',
}: {
	labels: OfflineLabels
	homeHref?: string
}) {
	return (
		<main className="flex min-h-dvh items-center justify-center bg-background px-6 py-12 text-foreground">
			<div className="w-full max-w-md text-center">
				<div className="mb-12 flex items-center justify-center gap-3">
					<BrandMark size={32} />
					<Wordmark height={22} />
					<span className="sr-only">Puzzled</span>
				</div>
				<div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
					<WifiOff className="h-7 w-7 text-muted-foreground" aria-hidden="true" />
				</div>
				<h1 className="font-display text-4xl leading-tight tracking-tight sm:text-5xl">
					{labels.title}
				</h1>
				<p className="mx-auto mt-4 max-w-xs text-[17px] leading-relaxed text-muted-foreground">
					{labels.description}
				</p>
				<Button asChild size="lg" className="mt-8 w-full sm:w-auto">
					<a href={homeHref}>
						<RefreshCw className="h-4 w-4" aria-hidden="true" />
						{labels.retry}
					</a>
				</Button>
			</div>
		</main>
	)
}
