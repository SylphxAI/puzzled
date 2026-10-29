'use client'

import { useEffect } from 'react'
import { canTrackAnalytics, onConsentChange } from '@/features/analytics/lib/consent'
import { sendFunnel } from '@/features/analytics/lib/funnel'
import { createPuzzleServiceClient } from '@/lib/connect/puzzle-client'

/** A visible visit is anonymous; linking it to a finish requires analytics opt-in. */
export function ShareLandingReporter({ shareId }: { shareId: string }) {
	useEffect(() => {
		sendFunnel({ event: 'share_landing' })
		const sync = () => {
			try {
				if (!canTrackAnalytics()) return
				void createPuzzleServiceClient()
					.recordShareLanding({ shareId, analyticsConsent: true })
					.catch(() => {})
			} catch {
				// Disabled storage, offline or denied consent never blocks a share.
			}
		}
		sync()
		return onConsentChange(sync)
	}, [shareId])
	return null
}
