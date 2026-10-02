'use client'

import { useTranslations } from 'next-intl'
import { withdrawCookieChoice } from '@/features/analytics/lib/consent'
import { useSafeConsent } from '@/lib/identity/react'

/**
 * "Change cookie choice": withdraws what was granted (analytics, advertising
 * and the Google cookies), records the withdrawal, and reloads so the cookie
 * banner asks again.
 */
export function ChangeCookieChoice({
	tagIds = [],
	className = 'inline-flex min-h-11 items-center justify-center rounded-xl border px-4 font-medium text-foreground transition-colors hover:bg-muted',
	label,
}: {
	tagIds?: string[]
	/** Replaces the default button look, for example a footer link. */
	className?: string
	/** Replaces the default "Change cookie choice" label. */
	label?: string
}) {
	const t = useTranslations('consent')
	const { setConsent } = useSafeConsent()
	return (
		<button
			type="button"
			className={className}
			onClick={() => {
				void setConsent({ analytics: false, marketing: false })
					.catch(() => undefined)
					.finally(() => {
						withdrawCookieChoice(tagIds)
						window.location.reload()
					})
			}}
		>
			{label ?? t('change')}
		</button>
	)
}
