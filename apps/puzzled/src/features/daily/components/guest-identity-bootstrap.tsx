'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { ensureGuestSession, type GuestSessionResult } from '@/lib/connect/transport'
import { afterFirstPaint } from '@/shared/components/deferred-shell'

/** The bootstrap lifecycle, with a narrow seam for paint/unmount tests. */
export function bootstrapGuestIdentity(
	refreshed: { current: boolean },
	refresh: () => void,
	admit: () => Promise<GuestSessionResult> = ensureGuestSession,
	schedule: (callback: () => void) => () => void = afterFirstPaint,
): () => void {
	let active = true
	const cancel = schedule(() => {
		void admit()
			.then((result) => {
				if (!active || !result.issued || refreshed.current) return
				refreshed.current = true
				refresh()
			})
			.catch(() => {
				// A future RPC may retry admission; never loop or fake a ready cookie.
			})
	})
	return () => {
		active = false
		cancel()
	}
}

/** Refresh the anonymous RSC payload once, only when the server issued a cookie. */
export function GuestIdentityBootstrap() {
	const router = useRouter()
	const refreshed = useRef(false)
	useEffect(() => bootstrapGuestIdentity(refreshed, () => router.refresh()), [router])
	return null
}
