'use client'

import { ExternalLink } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { rememberCheckoutQuote } from '@/features/analytics/lib/google-tag'
import { trackCheckoutStarted, trackOfferClicked } from '@/features/analytics/lib/plus-funnel'
import { startCheckout } from '@/lib/connect/billing-client'
import { Link } from '@/lib/i18n/routing'
import { logger } from '@/lib/logger'

type Props = {
	planId: string
	currency: string
	/** The plan's price in `currency`, minor units: what a trial converts to. */
	amountMinor: number
	interval: 'month' | 'year'
	trial: boolean
	locale: string
	signedIn: boolean
	subscribed: boolean
	label: string
	/** What the buyer is agreeing to renew at, shown between the consent tick and the button. */
	renewalNote?: string
}

/** Starts checkout for one plan once the buyer has consented to immediate supply; guests are sent to sign in first. */
export function SubscribeButton({
	planId,
	currency,
	amountMinor,
	interval,
	trial,
	locale,
	signedIn,
	subscribed,
	label,
	renewalNote,
}: Props) {
	const t = useTranslations('plus.pricing')
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [consent, setConsent] = useState(false)
	const buttonClass =
		'pressable inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60'

	if (!signedIn) {
		return (
			<Link
				href={{ pathname: '/login', query: { callbackUrl: '/pricing' } }}
				className={buttonClass}
			>
				{t('signInToSubscribe')}
			</Link>
		)
	}
	if (subscribed) {
		return (
			<Link href="/settings/subscription" className={buttonClass}>
				{t('currentPlan')}
			</Link>
		)
	}

	return (
		<div>
			<label className="mb-3 flex min-h-11 cursor-pointer items-start gap-3 text-sm">
				<input
					type="checkbox"
					className="mt-0.5 h-5 w-5 shrink-0 accent-primary"
					checked={consent}
					onChange={(event) => setConsent(event.target.checked)}
				/>
				<span>{t('immediateSupplyConsent')}</span>
			</label>
			{locale === 'ja' && (
				<Link
					href="/tokushoho"
					className="mb-3 inline-flex min-h-11 items-center text-sm underline underline-offset-2"
				>
					特定商取引法に基づく表記
				</Link>
			)}
			{renewalNote ? <p className="mb-3 text-sm text-muted-foreground">{renewalNote}</p> : null}
			<button
				type="button"
				className={buttonClass}
				disabled={busy || !consent}
				onClick={async () => {
					setBusy(true)
					setError(null)
					try {
						// What the checkout return reports to Google Ads (kept only with consent).
						rememberCheckoutQuote({
							plan: planId,
							value: amountMinor / 100,
							currency: currency.toUpperCase(),
						})
						trackOfferClicked('pricing')
						trackCheckoutStarted({ plan: planId, interval, trial })
						window.location.assign(await startCheckout(planId, locale, currency, consent))
					} catch (err) {
						logger.error('plus.checkout-failed', { planId, error: err })
						const message = err instanceof Error ? err.message : ''
						setError(
							message.includes('already_subscribed')
								? t('alreadySubscribed')
								: message.includes('consent_required')
									? t('consentRequired')
									: message.includes('plan_not_on_sale')
										? t('purchasesSoon')
										: t('checkoutFailed'),
						)
						setBusy(false)
					}
				}}
			>
				{busy ? t('subscribing') : label}
				<ExternalLink className="h-4 w-4" aria-hidden="true" />
			</button>
			{error ? (
				<p role="alert" className="mt-2 text-sm text-destructive">
					{error}
				</p>
			) : null}
		</div>
	)
}
