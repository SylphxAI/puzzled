import { Lock } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { DAILY_FREE_PICKS } from '@/features/daily/lib/daily-picks'
import { CheckoutOffer } from '@/features/plus-offer/components/checkout-offer'
import { Link } from '@/lib/i18n/routing'

type GameUnlockPanelProps = {
	slug: string
	/** The request was for a past day, not another game. */
	archive: boolean
	/** Specific archive date being unlocked, if any (`YYYY-MM-DD`). */
	dateParam?: string
	gameCount: number
	/** No account on this request. */
	isGuest: boolean
}

/**
 * The path for a game or day that needs Tryit Plus (a fourth game today, once
 * the three free picks are used, or a past day): direct checkout, guest
 * sign-in, and a return path to today's games.
 */
export async function GameUnlockPanel({
	slug,
	archive,
	dateParam,
	gameCount,
	isGuest,
}: GameUnlockPanelProps) {
	const t = await getTranslations('plus.unlock')
	const returnTo =
		archive && dateParam
			? `/games/${slug}?mode=archive&date=${encodeURIComponent(dateParam)}`
			: `/games/${slug}`

	return (
		<div
			className="mx-auto w-full max-w-xl text-center"
			data-unlock-panel={archive ? 'archive' : 'picks'}
		>
			<div className="flex flex-col items-center gap-4">
				{archive ? (
					<span className="flex h-14 w-14 items-center justify-center rounded-2xl border-[1.5px] border-[var(--tactile-line)] bg-card shadow-[0_3px_0_0_var(--tactile-edge)]">
						<Lock className="h-6 w-6" aria-hidden="true" />
					</span>
				) : (
					// The masthead's three pick slots, all used: the same object, now full.
					<span className="picks-pill" aria-hidden="true">
						<span className="flex items-center gap-1">
							{Array.from({ length: DAILY_FREE_PICKS }, (_, i) => (
								<span key={i} className="picks-slot picks-slot-used" />
							))}
						</span>
						<span className="numeral">
							{DAILY_FREE_PICKS} / {DAILY_FREE_PICKS}
						</span>
					</span>
				)}
				<h2 className="font-display text-2xl leading-tight text-balance md:text-[1.75rem]">
					{archive ? t('archiveTitle') : t('title')}
				</h2>
				<div className="w-full text-left">
					<CheckoutOffer signedIn={!isGuest} callbackUrl={returnTo} gameCount={gameCount} />
				</div>
				<div className="flex w-full flex-col items-stretch gap-3 sm:flex-row sm:justify-center">
					{isGuest ? (
						<Link
							href={{ pathname: '/login', query: { callbackUrl: returnTo } }}
							className="inline-flex h-12 items-center justify-center rounded-xl border-[1.5px] border-[var(--tactile-line)] bg-card px-5 font-semibold hover:bg-muted"
						>
							{t('signIn')}
						</Link>
					) : null}
					<Link
						href="/games"
						className="inline-flex h-12 items-center justify-center rounded-xl border-[1.5px] border-[var(--tactile-line)] bg-card px-5 font-semibold hover:bg-muted"
					>
						{t('backToToday')}
					</Link>
				</div>
				<p className="text-xs text-muted-foreground">{t('keep')}</p>
			</div>
		</div>
	)
}
