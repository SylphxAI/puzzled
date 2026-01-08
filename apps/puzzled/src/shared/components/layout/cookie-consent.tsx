'use client'

import { Cookie, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { getConsentStatus, setConsentStatus } from '@/features/analytics/lib/consent'
import { Link } from '@/lib/i18n/routing'
import { Button } from '@sylphx/ui'

export function CookieConsent() {
	const t = useTranslations('consent')
	const [showBanner, setShowBanner] = useState(false)

	useEffect(() => {
		// Check if user has already consented using the centralized consent module
		const status = getConsentStatus()
		if (status === 'pending') {
			// Small delay to avoid layout shift on initial load
			const timer = setTimeout(() => setShowBanner(true), 1000)
			return () => clearTimeout(timer)
		}
	}, [])

	const handleAccept = () => {
		// Use centralized consent management which triggers PostHog initialization
		setConsentStatus('accepted')
		setShowBanner(false)
	}

	const handleDecline = () => {
		// Use centralized consent management which prevents PostHog initialization
		setConsentStatus('declined')
		setShowBanner(false)
	}

	if (!showBanner) return null

	return (
		<div
			role="region"
			aria-label={t('title')}
			aria-live="polite"
			className="fixed inset-x-0 z-overlay animate-slide-up p-4"
			style={{ bottom: 'calc(var(--bottom-nav-height) + var(--safe-area-bottom) + 8px)' }}
		>
			<div className="mx-auto max-w-lg rounded-xl border bg-card p-4 shadow-lg">
				<div className="flex items-start gap-3">
					<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
						<Cookie className="h-4 w-4 text-muted-foreground" />
					</div>
					<div className="flex-1 space-y-3">
						<p className="text-sm leading-relaxed text-foreground">{t('message')}</p>
						<p className="text-xs text-muted-foreground">
							{t('details')}{' '}
							<Link href="/privacy" className="text-primary underline hover:no-underline">
								{t('learnMore')}
							</Link>
						</p>
						<div className="flex flex-wrap gap-2">
							<Button size="sm" onClick={handleAccept}>
								{t('accept')}
							</Button>
							<Button size="sm" variant="outline" onClick={handleDecline}>
								{t('decline')}
							</Button>
						</div>
					</div>
					<button
						type="button"
						onClick={handleDecline}
						className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
						aria-label="Close"
					>
						<X className="h-4 w-4" />
					</button>
				</div>
			</div>
		</div>
	)
}
