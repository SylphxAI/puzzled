'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { trialEndDate } from '@/lib/billing/plus'

/**
 * The pricing page's trial sentence with its real first-charge date, worked
 * out in the viewer's own time zone (the server's would show a US evening
 * viewer the wrong day). Renders after mount, once the viewer's zone is known.
 */
export function TrialChargeLine({ days, price }: { days: number; price: string }) {
	const t = useTranslations('plus.pricing')
	const locale = useLocale()
	const [date, setDate] = useState<string | null>(null)
	useEffect(() => setDate(trialEndDate(new Date(), days, locale)), [days, locale])
	if (!date) return null
	return <p className="pt-1 text-sm font-semibold">{t('trialLine', { days, price, date })}</p>
}
