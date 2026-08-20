'use client'

import { useEffect } from 'react'
import { getOrCreateGuestDayId } from '@/lib/guest-day-id'

/**
 * Mirror the stable guest day id onto the cookie so SSR GetDaily / GetUserStats
 * / GetHistory can read the same identity as client Connect. This does not
 * invent completion; it only forwards the identity the server already uses.
 */
export function GuestIdentityBootstrap() {
	useEffect(() => {
		getOrCreateGuestDayId()
	}, [])

	return null
}
