'use client'

import { create } from '@bufbuild/protobuf'
import { createClient } from '@connectrpc/connect'
import { Button } from '@sylphx/ui'
import { Sparkles } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import {
	GamificationService,
	GetStreakInfoRequestSchema,
} from '@/gen/connect/puzzled/v1/gamification_pb'
import { getConnectTransport } from '@/lib/connect/transport'
import { Link } from '@/lib/i18n/routing'
import { useSafeUser } from '@/lib/identity/react'
import { GuestSignupPrompt } from './guest-signup-prompt'

/** The inline card appears at the first finished day; the modal waits for a run. */
export function shouldShowStreakCard(signedIn: boolean, daily: boolean, streak: number): boolean {
	return !signedIn && daily && streak >= 1
}

export function shouldOfferStreakSave(signedIn: boolean, daily: boolean, streak: number): boolean {
	return !signedIn && daily && streak >= 2
}

/** Sign-up that returns the player to the game they just finished. */
export function signupHref(gameSlug?: string): {
	pathname: '/signup'
	query?: { callbackUrl: string }
} {
	return gameSlug
		? { pathname: '/signup', query: { callbackUrl: `/games/${gameSlug}` } }
		: { pathname: '/signup' }
}

/** Runs only on a finished daily screen, not in the middle of play. */
export function SaveStreakPrompt({ daily, gameSlug }: { daily: boolean; gameSlug?: string }) {
	const t = useTranslations('onboarding')
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
		<>
			{shouldShowStreakCard(isSignedIn, daily, streak) ? (
				<section
					aria-label={t('saveStreak')}
					className="mx-4 mb-3 mt-1 rounded-2xl border border-border bg-muted/50 p-4 text-center"
				>
					<h3 className="flex items-center justify-center gap-2 font-display text-lg">
						<Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
						{t('saveStreak')}
					</h3>
					<p className="mt-1 text-sm text-muted-foreground">{t('keepStreak', { days: streak })}</p>
					<p className="mt-1 text-xs text-muted-foreground">{t('saveStreakNote')}</p>
					<Button asChild className="mt-3 w-full" size="lg">
						<Link href={signupHref(gameSlug)}>{t('createFreeAccount')}</Link>
					</Button>
				</section>
			) : null}
			<GuestSignupPrompt
				open={!dismissed && shouldOfferStreakSave(isSignedIn, daily, streak)}
				onClose={() => setDismissed(true)}
				streakCount={streak}
				gameSlug={gameSlug}
			/>
		</>
	)
}
