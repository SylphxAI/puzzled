import { Lock } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
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
	/** Legacy caller compatibility; no particular free game is promoted here. */
	freeGameSlug?: string
	freeGameName?: string
}

/**
 * The path for a game or day that needs Tryit Plus: direct checkout, guest
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
		<div className="rounded-3xl border border-border/70 bg-card p-6 text-center shadow-card md:p-8">
			<div className="mx-auto flex max-w-lg flex-col items-center gap-4">
				<span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
					<Lock className="h-7 w-7" aria-hidden="true" />
				</span>
				<h2 className="font-display text-xl md:text-2xl">
					{archive ? t('archiveTitle') : t('title')}
				</h2>
				<div className="w-full text-left">
					<CheckoutOffer signedIn={!isGuest} callbackUrl={returnTo} gameCount={gameCount} />
				</div>
				<div className="flex w-full flex-col items-stretch gap-3 sm:flex-row sm:justify-center">
					{isGuest ? (
						<Link
							href={{ pathname: '/login', query: { callbackUrl: returnTo } }}
							className="inline-flex h-12 items-center justify-center rounded-2xl border border-border bg-background px-5 font-semibold hover:border-primary/30 hover:text-primary"
						>
							{t('signIn')}
						</Link>
					) : null}
					<Link
						href="/games"
						className="inline-flex h-12 items-center justify-center rounded-2xl border border-border bg-background px-5 font-semibold hover:border-foreground/30"
					>
						{t('backToToday')}
					</Link>
				</div>
				<p className="text-xs text-muted-foreground">{t('keep')}</p>
			</div>
		</div>
	)
}
