'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { TrialChargeLine } from '@/features/plus/components/trial-charge-line'
import { formatPrice, type PlanCard, yearlySavingPercent } from '@/lib/billing/plus'
import { cn } from '@/lib/utils'
import { SubscribeButton } from './subscribe-button'

type Props = {
	/** Plus Yearly and Monthly in the chosen currency; either may be missing from the catalogue. */
	yearly: PlanCard | undefined
	monthly: PlanCard | undefined
	locale: string
	signedIn: boolean
}

/**
 * The first-screen Plus offer: Yearly preselected, Monthly beside it, then the
 * one checkout button. The consent tick (never pre-ticked) and the button are
 * `SubscribeButton`, so checkout is wired exactly as before; this only chooses
 * which plan it starts.
 */
export function PlusOffer({ yearly, monthly, locale, signedIn }: Props) {
	const t = useTranslations('plus.pricing')
	const [interval, setInterval] = useState<'year' | 'month'>(yearly ? 'year' : 'month')
	const selected = interval === 'year' ? yearly : monthly
	if (!selected) return null

	const price = (card: PlanCard) => formatPrice(card.amountMinor, card.currency, locale)
	const saving =
		yearly && monthly ? yearlySavingPercent(monthly.amountMinor, yearly.amountMinor) : null
	const options = [yearly, monthly].filter((card): card is PlanCard => Boolean(card))

	return (
		<div className="surface-card border-2 border-foreground p-4 shadow-lg sm:p-5">
			<fieldset className="grid gap-2 border-0 p-0">
				<legend className="sr-only">{t('planChoice')}</legend>
				{options.map((card) => {
					const isYear = card.interval === 'year'
					const checked = card.interval === interval
					return (
						<label
							key={card.id}
							className={cn(
								'flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring',
								checked ? 'border-foreground bg-muted/50' : 'border-border hover:bg-muted/40',
							)}
						>
							<input
								type="radio"
								name="plus-interval"
								value={card.interval}
								checked={checked}
								onChange={() => setInterval(card.interval)}
								className="h-5 w-5 shrink-0 accent-primary"
							/>
							<span className="min-w-0 flex-1">
								<span className="flex flex-wrap items-center gap-x-2 font-semibold">
									{isYear ? t('yearly') : t('monthly')}
									{isYear && saving ? (
										<span className="chip bg-success/15 text-success">
											{t('saving', { percent: saving })}
										</span>
									) : null}
								</span>
								{isYear ? (
									<span className="block text-sm text-muted-foreground tnum">
										{t('monthlyEquivalent', {
											price: formatPrice(Math.round(card.amountMinor / 12), card.currency, locale),
										})}
									</span>
								) : null}
							</span>
							<span className="text-right">
								<span className="block font-display text-xl tnum">{price(card)}</span>
								<span className="block text-xs text-muted-foreground">
									{isYear ? t('perYear') : t('perMonth')}
								</span>
							</span>
						</label>
					)
				})}
			</fieldset>
			{selected.interval === 'year' && selected.trialDays > 0 ? (
				<TrialChargeLine days={selected.trialDays} price={price(selected)} />
			) : null}
			<div className="mt-4">
				<SubscribeButton
					planId={selected.id}
					currency={selected.currency}
					amountMinor={selected.amountMinor}
					interval={selected.interval}
					trial={selected.trialDays > 0}
					locale={locale}
					signedIn={signedIn}
					subscribed={false}
					label={
						selected.trialDays > 0
							? t('startTrial', { days: selected.trialDays })
							: t('continueToPayment')
					}
					renewalNote={t(selected.interval === 'year' ? 'renewsYearly' : 'renewsMonthly', {
						price: price(selected),
					})}
				/>
			</div>
		</div>
	)
}
