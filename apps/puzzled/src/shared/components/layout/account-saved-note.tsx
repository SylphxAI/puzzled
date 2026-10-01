'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { SIGNED_UP_PARAM } from '@/lib/identity/after-sign-up'

/**
 * A calm, one-time confirmation after creating an account. The sign-up flow
 * lands here with `?signedUp=1`; the marker is removed from the address as
 * soon as it is read, so a reload or a shared link never shows it again.
 */
export function AccountSavedNote() {
	const t = useTranslations('auth')
	const [visible, setVisible] = useState(false)

	useEffect(() => {
		const url = new URL(window.location.href)
		if (url.searchParams.get(SIGNED_UP_PARAM) !== '1') return
		url.searchParams.delete(SIGNED_UP_PARAM)
		window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
		setVisible(true)
	}, [])

	if (!visible) return null
	return (
		<output className="page-shell-wide block pt-3">
			<p className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-foreground">
				{t('accountSaved')}
			</p>
		</output>
	)
}
