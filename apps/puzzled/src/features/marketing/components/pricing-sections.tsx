import { CalendarClock, Mail, Server, ShieldCheck } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { SUPPORT_EMAIL } from '@/lib/config/app'
import { Link } from '@/lib/i18n/routing'
import { MarketingSection } from './marketing-section'

type BillingFact = {
	icon: typeof ShieldCheck
	title: string
	body: string
	/** Optional real control on the card; never a control that leads nowhere. */
	action?: { href: string; label: string }
}

/**
 * How money is handled on this product, in four statements the code supports:
 * checkout is the provider's, entitlement is the server's, cancellation lives
 * in the console, and refunds go through support.
 */
export async function PricingBillingFacts() {
	const t = await getTranslations('pricing')
	const facts: BillingFact[] = [
		{ icon: ShieldCheck, title: t('billing.secureTitle'), body: t('billing.secureBody') },
		{ icon: Server, title: t('billing.entitlementTitle'), body: t('billing.entitlementBody') },
		{
			icon: CalendarClock,
			title: t('billing.cancelTitle'),
			body: t('billing.cancelBody'),
			action: { href: '/settings/subscription', label: t('billing.cancelAction') },
		},
		{
			icon: Mail,
			title: t('billing.refundTitle'),
			body: t('billing.refundBody', { email: SUPPORT_EMAIL }),
			action: { href: `mailto:${SUPPORT_EMAIL}`, label: SUPPORT_EMAIL },
		},
	]

	return (
		<MarketingSection id="billing" title={t('billing.title')} subtitle={t('billing.subtitle')}>
			<ul className="grid gap-3 sm:grid-cols-2">
				{facts.map(({ icon: Icon, title, body, action }) => (
					<li key={title} className="rounded-2xl border border-border/70 bg-surface-muted/60 p-5">
						<span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
							<Icon className="h-5 w-5" aria-hidden="true" />
						</span>
						<h3 className="mt-3 font-display text-base font-bold">{title}</h3>
						<p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
						{action &&
							(action.href.startsWith('/') ? (
								<Link
									href={action.href}
									className="mt-3 inline-flex min-h-11 items-center font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
								>
									{action.label}
								</Link>
							) : (
								<a
									href={action.href}
									className="mt-3 inline-flex min-h-11 items-center font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
								>
									{action.label}
								</a>
							))}
					</li>
				))}
			</ul>
		</MarketingSection>
	)
}

/**
 * Free vs Premium in one table.
 *
 * Every row is a capability the product actually gates today: the free
 * rotation, the archive, per-module statistics and streak freezes. Premium is
 * the only paid tier, so the monthly/annual choice is a billing interval, not
 * a second product.
 */
export async function PricingComparison({ moduleCount }: { moduleCount: number }) {
	const t = await getTranslations('pricing')
	const rows: readonly (readonly [string, string, string])[] = [
		[
			t('compare.rowSuite'),
			t('compare.rowSuiteFree'),
			t('compare.rowSuitePremium', { count: moduleCount }),
		],
		[t('compare.rowArchive'), t('compare.rowArchiveFree'), t('compare.rowArchivePremium')],
		[t('compare.rowStats'), t('compare.rowStatsFree'), t('compare.rowStatsPremium')],
		[t('compare.rowFreeze'), t('compare.rowFreezeFree'), t('compare.rowFreezePremium')],
	]

	return (
		<MarketingSection id="compare" title={t('compare.title')} subtitle={t('compare.subtitle')}>
			{/*
			 * Keyboard-reachable scroll container: a wide comparison table on a
			 * narrow screen is only usable if the region itself can be focused.
			 */}
			<section
				// biome-ignore lint/a11y/noNoninteractiveTabindex: scroll containers need focus for keyboard users
				tabIndex={0}
				aria-label={t('compare.title')}
				className="overflow-x-auto rounded-2xl border border-border/70 bg-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
			>
				<table className="w-full min-w-[34rem] border-collapse text-sm">
					<caption className="sr-only">{t('compare.title')}</caption>
					<thead>
						<tr className="bg-surface-muted/60 text-left">
							<th scope="col" className="px-4 py-3 font-semibold">
								{t('compare.featureColumn')}
							</th>
							<th scope="col" className="px-4 py-3 font-semibold">
								{t('compare.freeColumn')}
							</th>
							<th scope="col" className="px-4 py-3 font-semibold">
								{t('compare.premiumColumn')}
							</th>
						</tr>
					</thead>
					<tbody>
						{rows.map(([label, free, premium]) => (
							<tr key={label} className="border-t border-border/70 align-top">
								<th scope="row" className="px-4 py-3 text-left font-semibold">
									{label}
								</th>
								<td className="px-4 py-3 leading-relaxed text-muted-foreground">{free}</td>
								<td className="px-4 py-3 leading-relaxed text-muted-foreground">{premium}</td>
							</tr>
						))}
					</tbody>
				</table>
			</section>
		</MarketingSection>
	)
}
