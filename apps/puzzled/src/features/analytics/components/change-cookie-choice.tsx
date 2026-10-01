'use client'

import { useTranslations } from 'next-intl'
import { withdrawCookieChoice } from '@/features/analytics/lib/consent'
import { useSafeConsent } from '@/lib/identity/react'

/**
 * "Change cookie choice": withdraws what was granted (analytics, advertising
 * and the Google cookies), records the withdrawal, and reloads so the cookie
 * banner asks again.
 */
export function ChangeCookieChoice() {
	const t = useTranslations('consent')
	const { setConsent } = useSafeConsent()
	return (
		<button
			type="button"
			className="inline-flex min-h-11 items-center justify-center rounded-xl border px-4 font-medium text-foreground transition-colors hover:bg-muted"
			onClick={() => {
				void setConsent({ analytics: false, marketing: false })
					.catch(() => undefined)
					.finally(() => {
						withdrawCookieChoice()
						window.location.reload()
					})
			}}
		>
			{t('change')}
		</button>
	)
}
