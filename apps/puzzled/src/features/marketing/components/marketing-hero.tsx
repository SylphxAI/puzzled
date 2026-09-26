import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type MarketingHeroProps = {
	/** Short factual label above the h1 (e.g. the surface name). */
	eyebrow?: string
	/** The single h1 of the page. */
	title: string
	/** Value proposition in plain language; never a badge or a promise. */
	lead?: string
	/** Verifiable facts rendered as chips directly under the lead. */
	facts?: readonly string[]
	/** Primary actions (links/buttons) shown under the copy. */
	actions?: ReactNode
	/** Optional panel rendered beside the copy on large screens. */
	aside?: ReactNode
	className?: string
}

/**
 * Shared hero band for marketing surfaces (pricing, support, legal).
 *
 * Owns the page's only h1. The aurora field is decorative, so it stays behind
 * `aria-hidden` decoration-free markup: no text is ever placed on the field
 * without a solid surface behind it.
 */
export function MarketingHero({
	eyebrow,
	title,
	lead,
	facts,
	actions,
	aside,
	className,
}: MarketingHeroProps) {
	return (
		<section className={cn('relative', className)}>
			<div className="page-shell-wide pb-8 pt-8 md:pb-12 md:pt-14">
				<div
					className={cn(
						'animate-enter',
						aside && 'grid items-start gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12',
					)}
				>
					<div>
						{eyebrow && <p className="eyebrow">{eyebrow}</p>}
						<h1 className="mt-2 font-display text-[2.125rem] leading-[1.06] text-balance sm:text-5xl lg:text-[3.5rem]">
							{title}
						</h1>
						{lead && (
							<p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-muted-foreground md:text-lg">
								{lead}
							</p>
						)}
						{facts && facts.length > 0 && (
							<ul className="mt-5 flex flex-wrap gap-2">
								{facts.map((fact) => (
									<li
										key={fact}
										className="chip border border-border bg-card font-medium text-muted-foreground"
									>
										{fact}
									</li>
								))}
							</ul>
						)}
						{actions && <div className="mt-6 flex flex-wrap items-center gap-3">{actions}</div>}
					</div>
					{aside}
				</div>
			</div>
		</section>
	)
}
