'use client'

import { create } from '@bufbuild/protobuf'
import { createClient } from '@connectrpc/connect'
import { useEffect, useState } from 'react'
import {
	GamificationService,
	GetStreakInfoRequestSchema,
} from '@/gen/connect/puzzled/v1/gamification_pb'
import { getConnectTransport } from '@/lib/connect/transport'
import { useSafeUser } from '@/lib/identity/react'
import { GuestSignupPrompt } from './guest-signup-prompt'

export function shouldOfferStreakSave(signedIn: boolean, daily: boolean, streak: number): boolean {
	return !signedIn && daily && streak >= 2
}

/** Runs only on a finished daily screen, not in the middle of play. */
export function SaveStreakPrompt({ daily }: { daily: boolean }) {
	const { isSignedIn, isLoaded } = useSafeUser()
	const [streak, setStreak] = useState(0)
	const [dismissed, setDismissed] = useState(false)
	useEffect(() => {
		if (!isLoaded || isSignedIn || !daily) return
		let cancelled = false
		const client = createClient(GamificationService, getConnectTransport())
		client
			.getStreakInfo(create(GetStreakInfoRequestSchema, {}))
			.then((response) => {
				if (!cancelled) setStreak(response.info?.currentStreak ?? 0)
			})
			.catch(() => undefined)
		return () => {
			cancelled = true
		}
	}, [isLoaded, isSignedIn, daily])
	return (
		<GuestSignupPrompt
			open={!dismissed && shouldOfferStreakSave(isSignedIn, daily, streak)}
			onClose={() => setDismissed(true)}
			streakCount={streak}
		/>
	)
}
