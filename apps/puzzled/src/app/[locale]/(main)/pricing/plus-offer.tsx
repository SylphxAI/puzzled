'use client'

import { Check } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { TrialChargeLine } from '@/features/plus/components/trial-charge-line'
import {
	formatMonthlyEquivalentPrice,
	formatPrice,
	type PlanCard,
	yearlySavingPercent,
} from '@/lib/billing/plus'
import { cn } from '@/lib/utils'
import styles from './pricing.module.css'
import { SubscribeButton } from './subscribe-button'

type Props = {
	/** HTML anchor id (`plus` or `family`). */
	id: 'plus' | 'family'
	/** Card heading (e.g. `Tryit Plus` or `Tryit Family`). */
	title: string
	/** Short subtitle under the card heading. */
	subtitle: string
	/** Accent square marker shown beside the primary Individual plan heading. */
	accentDot?: boolean
	/** Primary visual emphasis for the flagship Individual tier. */
	emphasized?: boolean
	/** Benefit lines for this tier. */
	features?: string[]
	/** Radio group name so Individual and Family selectors stay independent. */
	radioName: string
	/** Sign-in return anchor. */
	returnAnchor?: 'plus' | 'family'
	/** Available interval options for this tier in the chosen currency. */
	once?: PlanCard
	yearly: PlanCard | undefined
	monthly: PlanCard | undefined
	locale: string
	signedIn: boolean
	subscribed: boolean
	initialPlan?: string
	/** Safe post-checkout return destination (e.g. from GameUnlockPanel). */
	callbackUrl?: string
	/** Slot rendered at the top of the column above the card (e.g. currency switcher). */
	headerSlot?: ReactNode
	/** Slot rendered below the card (e.g. anchor & free-play links). */
	footerSlot?: ReactNode
}

/**
 * Single tier offer card (Yearly preselected alongside Monthly and any pass
 * option) with one interval radio group, direct price readout, and one
 * SubscribeButton checkout flow.
 */
export function PlusOffer({
	id,
	title,
	subtitle,
	accentDot = false,
	emphasized = false,
	features = [],
	radioName,
	once,
	yearly,
	monthly,
	locale,
	signedIn,
	subscribed,
	initialPlan,
	callbackUrl,
	headerSlot,
	footerSlot,
}: Props) {
	const t = useTranslations('plus.pricing')
	const options = [once, yearly, monthly].filter((card): card is PlanCard => Boolean(card))
	const [interval, setInterval] = useState<'once' | 'year' | 'month'>(
		options.find((card) => card.id === initialPlan)?.interval ??
			(yearly ? 'year' : monthly ? 'month' : 'once'),
	)
	const selected = interval === 'once' ? once : interval === 'year' ? yearly : monthly
	if (!selected) return null

	const price = (card: PlanCard) => formatPrice(card.amountMinor, card.currency, locale)
	const saving =
		yearly && monthly ? yearlySavingPercent(monthly.amountMinor, yearly.amountMinor) : null
	const effectiveTrialDays = signedIn ? selected.trialDays : 0

	return (
		<div id={id} data-checkout-surface="" className={cn('scroll-mt-24', styles.offer)}>
			{headerSlot}
			<div
				className={cn(
					'surface-card flex flex-col p-4 sm:p-5',
					styles.card,
					emphasized && styles.featured,
				)}
			>
				<div className={styles.cardHeading}>
					<h2 className="flex items-center gap-2 font-display text-lg sm:text-xl">
						{accentDot ? (
							<span
								className="inline-block h-2.5 w-2.5 rounded-[3px] bg-accent-warm"
								aria-hidden="true"
							/>
						) : null}
						{title}
					</h2>
					<p className="text-xs text-muted-foreground sm:text-sm">{subtitle}</p>
				</div>
				<fieldset className="grid gap-2 border-0 p-0">
					<legend className="sr-only">{t('planChoice')}</legend>
					{options.map((card) => {
						const isOnce = card.interval === 'once'
						const isYear = card.interval === 'year'
						const checked = card.interval === interval
						return (
							<label
								key={card.id}
								className={cn(
									styles.option,
									'flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2',
									'transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring',
									checked ? styles.selected : 'border-border hover:bg-muted/40',
								)}
							>
								<input
									type="radio"
									name={radioName}
									value={card.interval}
									checked={checked}
									onChange={() => setInterval(card.interval)}
									className="h-5 w-5 shrink-0 accent-primary"
								/>
								<span className="min-w-0 flex-1">
									<span className="flex flex-wrap items-center gap-x-2 font-semibold">
										{isOnce
											? t('weekendPass', { days: card.accessDays })
											: isYear
												? t('yearly')
												: t('monthly')}
										{isYear && saving ? (
											<span className="chip bg-success/15 text-success">
												{t('saving', { percent: saving })}
											</span>
										) : null}
									</span>
									{isYear ? (
										<span className="block text-sm text-muted-foreground tnum">
											{t('monthlyEquivalent', {
												price: formatMonthlyEquivalentPrice(
													card.amountMinor,
													card.currency,
													locale,
												),
											})}
										</span>
									) : null}
								</span>
								<span className="text-right">
									<span className="block font-display text-xl tnum">{price(card)}</span>
									<span className="block text-xs text-muted-foreground">
										{isOnce ? t('oneTime') : isYear ? t('perYear') : t('perMonth')}
									</span>
								</span>
							</label>
						)
					})}
				</fieldset>
				{features.length > 0 ? (
					<ul className={styles.features}>
						{features.map((line) => (
							<li key={line} className="flex items-start gap-2">
								<Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
								{line}
							</li>
						))}
					</ul>
				) : null}
				{selected.interval === 'year' && effectiveTrialDays > 0 ? (
					<TrialChargeLine days={effectiveTrialDays} price={price(selected)} />
				) : null}
				<div className="mt-4">
					<SubscribeButton
						key={selected.id}
						checkoutTrigger="pricing_card"
						callbackUrl={callbackUrl}
						planId={selected.id}
						currency={selected.currency}
						amountMinor={selected.amountMinor}
						locale={locale}
						signedIn={signedIn}
						subscribed={subscribed}
						label={
							effectiveTrialDays > 0
								? t('startTrial', { days: effectiveTrialDays })
								: t('continueToPayment')
						}
						renewalNote={
							selected.interval === 'once'
								? t('passTerms', { days: selected.accessDays })
								: t(selected.interval === 'year' ? 'renewsYearly' : 'renewsMonthly', {
										price: price(selected),
									})
						}
					/>
				</div>
			</div>
			{footerSlot}
		</div>
	)
}
