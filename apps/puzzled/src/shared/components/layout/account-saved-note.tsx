'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { trackSignUp } from '@/features/analytics/lib/google-tag'
import { consumeSignUpCookie, SIGNED_UP_PARAM } from '@/lib/identity/after-sign-up'

/** How long the confirmation stays before it fades, long enough to read once. */
const TOAST_MS = 3000

/**
 * A calm, one-time confirmation after creating an account. The sign-up flow
 * lands here with `?signedUp=1`; the marker is removed from the address as
 * soon as it is read, so a reload or a shared link never shows it again.
 *
 * On `/pricing` it is a one-line toast that fades, because that first screen is
 * the Plus offer and a block here would push the checkout step below the fold.
 * Everywhere else it stays a block in the page flow.
 */
export function AccountSavedNote() {
	const t = useTranslations('auth')
	const [visible, setVisible] = useState(false)
	const [toast, setToast] = useState(false)

	useEffect(() => {
		const url = new URL(window.location.href)
		// Only the server's one-shot cookie (set for an account Auth just created)
		// counts; a link cannot forge it. It is deleted before firing.
		// biome-ignore lint/suspicious/noDocumentCookie: delete the one-shot sign-up cookie
		const method = consumeSignUpCookie(document)
		const saved = url.searchParams.get(SIGNED_UP_PARAM) === '1'
		if (!saved && !method) return
		url.searchParams.delete(SIGNED_UP_PARAM)
		window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
		if (method) trackSignUp(method)
		if (!saved) return
		const onPricing = url.pathname.endsWith('/pricing')
		setToast(onPricing)
		setVisible(true)
		if (!onPricing) return
		const timer = window.setTimeout(() => setVisible(false), TOAST_MS)
		return () => window.clearTimeout(timer)
	}, [])

	if (!visible) return null
	if (toast) {
		return (
			<output
				aria-live="polite"
				className={[
					'pointer-events-none fixed inset-x-0 top-16 z-40 flex justify-center px-4',
					'animate-fade-in',
				].join(' ')}
			>
				<p className="rounded-full bg-foreground px-4 py-2 text-sm text-background shadow-lg">
					{t('accountSaved')}
				</p>
			</output>
		)
	}
	return (
		<output className="page-shell-wide block pt-3">
			<p className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-foreground">
				{t('accountSaved')}
			</p>
		</output>
	)
}
