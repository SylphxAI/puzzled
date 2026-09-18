'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { getOrCreateGuestDayId, readGuestIdCookie } from '@/lib/guest-day-id'
import { afterFirstPaint } from '@/shared/components/deferred-shell'

/**
 * Mirror the stable guest day id onto the cookie so SSR GetDaily / GetUserStats
 * / GetHistory can read the same identity as client Connect. This does not
 * invent completion; it only forwards the identity the server already uses.
 *
 * If the cookie was missing or stale, refresh so this visit's RSC payload is
 * guest-bound instead of anonymous. The refresh is a second full render of the
 * route, so it is held until after the first paint: the document a player looks
 * at must not compete with our own bookkeeping.
 */
export function GuestIdentityBootstrap() {
	const router = useRouter()
	const refreshed = useRef(false)

	useEffect(() => {
		const cookieId = readGuestIdCookie()
		const id = getOrCreateGuestDayId()
		if (!id || refreshed.current || cookieId === id) return
		refreshed.current = true
		return afterFirstPaint(() => router.refresh())
	}, [router])

	return null
}
