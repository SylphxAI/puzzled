import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type MarketingCtaProps = {
	title: string
	body?: string
	/** Links or buttons; keep the primary action first. */
	children: ReactNode
	/** Optional supporting line under the actions (e.g. a policy note). */
	note?: string
	className?: string
}

/**
 * Inverted brand band that closes a marketing surface.
 *
 * The band is the only place a page uses the ink surface, so the closing call
 * to action stays recognisable across pricing, support and legal pages.
 */
export function MarketingCta({ title, body, children, note, className }: MarketingCtaProps) {
	return (
		<section className={cn('pb-12 md:pb-16', className)}>
			<div className="page-shell-wide">
				<div className="surface-ink relative overflow-hidden rounded-3xl px-6 py-10 text-center md:px-12 md:py-12">
					<div
						className="bg-grid-faint pointer-events-none absolute inset-0 opacity-40"
						aria-hidden="true"
					/>
					<div className="relative">
						<h2 className="font-display text-2xl text-balance text-white md:text-3xl">{title}</h2>
						{body && (
							<p className="mx-auto mt-3 max-w-xl text-sm text-white/75 md:text-base">{body}</p>
						)}
						<div className="mt-6 flex flex-wrap items-center justify-center gap-3">{children}</div>
						{note && <p className="mt-4 text-xs text-white/70">{note}</p>}
					</div>
				</div>
			</div>
		</section>
	)
}
