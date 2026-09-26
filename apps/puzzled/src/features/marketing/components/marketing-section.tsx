import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type MarketingSectionProps = {
	/** Anchor id; also names the section heading for assistive tech. */
	id: string
	title?: string
	subtitle?: string
	children: ReactNode
	/** Removes the top padding for sections that follow a hero directly. */
	flush?: boolean
	className?: string
	/** Optional trailing action (e.g. a link to the catalog). */
	action?: ReactNode
}

/**
 * One marketing section: heading, optional lead sentence, then content.
 *
 * Keeps the vertical rhythm and the heading level consistent across pricing,
 * support and legal surfaces.
 */
export function MarketingSection({
	id,
	title,
	subtitle,
	children,
	flush = false,
	className,
	action,
}: MarketingSectionProps) {
	const headingId = `${id}-heading`

	return (
		<section
			id={id}
			aria-labelledby={title ? headingId : undefined}
			// scroll-mt keeps an in-page anchor clear of the sticky h-16 shell header.
			className={cn('section-block scroll-mt-24', flush && 'pt-0', className)}
		>
			<div className="page-shell-wide">
				{(title || action) && (
					<div className="flex flex-wrap items-end justify-between gap-4">
						<div>
							{title && (
								<h2 id={headingId} className="font-display text-2xl text-balance md:text-3xl">
									{title}
								</h2>
							)}
							{subtitle && (
								<p className="mt-2 max-w-2xl leading-relaxed text-muted-foreground">{subtitle}</p>
							)}
						</div>
						{action}
					</div>
				)}
				<div className={title || action ? 'mt-6' : undefined}>{children}</div>
			</div>
		</section>
	)
}
