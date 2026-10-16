'use client'

import { ArrowUpRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { productForDay, productLink } from '../lib/cross-promo'

/**
 * One card for another of our own products, shown on the already-played view
 * and nowhere else. It is absent from the finish screen, so it never appears
 * during the free finish, and a product day shows one card, the same one on
 * every visit. The link is public: campaign tags only, no player data.
 */
export function OwnProductCard({ dayKey }: { dayKey: string }) {
	const product = productForDay(dayKey)
	const t = useTranslations('crossPromo')
	if (!product) return null
	return (
		<section
			aria-labelledby="own-product-title"
			className="w-full rounded-2xl border border-border bg-muted/50 p-4 text-center"
		>
			<h3 id="own-product-title" className="font-display text-base">
				{t(`${product.id}.title`)}
			</h3>
			<p className="mt-1 text-sm text-muted-foreground">{t(`${product.id}.body`)}</p>
			<a
				href={productLink(product)}
				rel="noopener noreferrer"
				className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-2xl bg-primary px-5 font-semibold text-primary-foreground"
			>
				{t(`${product.id}.title`)}
				<ArrowUpRight className="h-4 w-4" aria-hidden="true" />
			</a>
		</section>
	)
}
