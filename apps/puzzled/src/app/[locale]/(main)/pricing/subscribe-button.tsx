'use client'

import { ExternalLink } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { startCheckout } from '@/lib/connect/billing-client'
import { Link } from '@/lib/i18n/routing'
import { logger } from '@/lib/logger'

type Props = {
	planId: string
	currency: string
	locale: string
	signedIn: boolean
	subscribed: boolean
	label: string
}

/** Starts checkout for one plan once the buyer has consented to immediate supply; guests are sent to sign in first. */
export function SubscribeButton({ planId, currency, locale, signedIn, subscribed, label }: Props) {
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
			<label className="mb-3 flex items-start gap-2 text-sm">
				<input
					type="checkbox"
					className="mt-1 h-4 w-4"
					checked={consent}
					onChange={(event) => setConsent(event.target.checked)}
				/>
				<span>{t('immediateSupplyConsent')}</span>
			</label>
			<button
				type="button"
				className={buttonClass}
				disabled={busy || !consent}
				onClick={async () => {
					setBusy(true)
					setError(null)
					try {
						window.location.assign(await startCheckout(planId, locale, currency, consent))
					} catch (err) {
						logger.error('plus.checkout-failed', { planId, error: err })
						const message = err instanceof Error ? err.message : ''
						setError(
							message.includes('already_subscribed')
								? t('alreadySubscribed')
								: message.includes('consent_required')
									? t('consentRequired')
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
