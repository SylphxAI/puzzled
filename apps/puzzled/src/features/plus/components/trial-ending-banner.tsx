'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { formatTrialEnd } from '@/lib/billing/plus'
import { Link } from '@/lib/i18n/routing'

/**
 * One calm line in the last days of a paid Plus trial. The date is written in
 * the browser's own time zone, so it appears after mount (the server cannot
 * know the zone). `manageHref` is left out where the manage controls are
 * already on the page.
 */
export function TrialEndingBanner({ endMs, manageHref }: { endMs: number; manageHref?: string }) {
	const t = useTranslations('plus.trial')
	const tPricing = useTranslations('plus.pricing')
	const locale = useLocale()
	const [date, setDate] = useState<string | null>(null)
	useEffect(() => setDate(formatTrialEnd(endMs, locale)), [endMs, locale])
	if (!date) return null
	return (
		<output className="mx-auto mt-4 flex w-full max-w-3xl flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-xl bg-muted px-4 py-3 text-center text-sm">
			<span>{t('endingSoon', { date })}</span>
			{manageHref ? (
				<Link href={manageHref} className="font-semibold text-primary hover:underline">
					{tPricing('manage')}
				</Link>
			) : null}
		</output>
	)
}
