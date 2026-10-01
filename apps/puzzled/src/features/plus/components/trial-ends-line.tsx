'use client'

import { useLocale, useTranslations } from 'next-intl'
import { createContext, type ReactNode, useContext } from 'react'

const TrialContext = createContext<number | null>(null)

/** Hands the server's answer (the reverse trial runs, and when it ends) to result screens. */
export function PlusTrialProvider({
	endsMs,
	children,
}: {
	endsMs: number | null | undefined
	children: ReactNode
}) {
	return <TrialContext.Provider value={endsMs ?? null}>{children}</TrialContext.Provider>
}

/**
 * The true end of the free week of Puzzled Plus, on the result screen. Nothing
 * while no trial runs, and nothing is charged when it ends.
 */
export function TrialEndsLine({ className }: { className?: string }) {
	const endsMs = useContext(TrialContext)
	const t = useTranslations('plus.trial')
	const locale = useLocale()
	if (!endsMs || endsMs <= Date.now()) return null
	const date = new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(new Date(endsMs))
	return <p className={className ?? 'text-center text-sm font-medium'}>{t('endsOn', { date })}</p>
}
