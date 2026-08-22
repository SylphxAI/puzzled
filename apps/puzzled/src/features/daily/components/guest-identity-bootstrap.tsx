'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { getOrCreateGuestDayId, readGuestIdCookie } from '@/lib/guest-day-id'

/**
 * Mirror the stable guest day id onto the cookie so SSR GetDaily / GetUserStats
 * / GetHistory can read the same identity as client Connect. This does not
 * invent completion; it only forwards the identity the server already uses.
 *
 * If the cookie was missing or stale, refresh so this visit's RSC payload is
 * guest-bound instead of anonymous.
 */
export function GuestIdentityBootstrap() {
	const router = useRouter()
	const refreshed = useRef(false)

	useEffect(() => {
		const cookieId = readGuestIdCookie()
		const id = getOrCreateGuestDayId()
		if (!id || refreshed.current || cookieId === id) return
		refreshed.current = true
		router.refresh()
	}, [router])

	return null
}
