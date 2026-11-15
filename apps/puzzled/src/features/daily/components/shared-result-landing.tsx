import { getTranslations } from 'next-intl/server'
import {
	landingPlayTarget,
	parseShareId,
	type SharedResult,
	sharedPlayHref,
	sharedResultCard,
} from '@/features/daily/lib/challenge'
import { resultCardStringsFrom } from '@/features/daily/lib/result-card'
import { resolveModuleDisplayName } from '@/features/daily/lib/result-share'
import { getHowToPlayConfig } from '@/games/how-to-play-registry'
import { getTodaysFreeGame } from '@/lib/free-rotation'
import { Link } from '@/lib/i18n/routing'
import { productDayKey } from '@/lib/product-day'
import { getBaseUrl } from '@/lib/utils'
import { ChallengeMemoryWriter } from './challenge-memory'
import { ResultCardSummary } from './result-card-summary'
import { ShareLandingReporter } from './share-landing-reporter'

type SharedResultLandingProps = {
	shared: SharedResult | null
	shareId: string
	locale: string
	fallbackGameSlug?: string | null
	utmSource?: string
}

/**
 * The page a shared link opens: the sharer's non-spoiler result above an
 * invitation to play that puzzle game (preserving `ref` and `utm_source=share`).
 * When a share cannot be loaded (unknown id or unavailable api), falls back
 * gracefully to a neutral challenge prompt rather than dropping attribution.
 */
export async function SharedResultLanding({
	shared,
	shareId,
	locale,
	fallbackGameSlug,
	utmSource,
}: SharedResultLandingProps) {
	const t = await getTranslations({ locale, namespace: 'share.landing' })
	const tGames = await getTranslations({ locale, namespace: 'games' })
	const tChallenge = await getTranslations({ locale, namespace: 'share.challenge' })
	const tHome = await getTranslations({ locale, namespace: 'home.day' })
	const tCard = await getTranslations({ locale, namespace: 'share.card' })
	const today = { dayKey: productDayKey(), freeGameSlug: getTodaysFreeGame() }
	const canonicalShareId = parseShareId(shareId)

	const target = shared
		? landingPlayTarget(shared, today)
		: { gameSlug: fallbackGameSlug ?? today.freeGameSlug, sameAsShared: false }
	const card = shared
		? sharedResultCard(shared, {
				origin: getBaseUrl('origin'),
				gameName: resolveModuleDisplayName(tGames, target.gameSlug),
				theme: getHowToPlayConfig(target.gameSlug)?.display.theme ?? 'slate',
				locale,
			})
		: null
	const playName = resolveModuleDisplayName(tGames, target.gameSlug)
	const playHref = sharedPlayHref({
		gameSlug: target.gameSlug,
		shareId: shareId || undefined,
		utmSource,
	})

	return (
		<main className="flex-1">
			{canonicalShareId && <ShareLandingReporter shareId={canonicalShareId} />}
			{shared && target.sameAsShared && canonicalShareId && (
				<ChallengeMemoryWriter
					shareId={canonicalShareId}
					gameSlug={target.gameSlug}
					dayKey={shared.dayKey}
				/>
			)}
			<div className="page-shell py-10 md:py-16">
				<div className="mx-auto w-full max-w-md">
					<p className="text-center text-sm font-medium text-muted-foreground">{t('eyebrow')}</p>
					<h1 className="mt-2 text-balance text-center font-display text-[2rem] leading-tight md:text-4xl">
						{target.sameAsShared ? t('titleSame') : t('titleOther')}
					</h1>

					{card && (
						<div className="mt-6">
							<p className="mb-2 text-center text-[15px]">
								<span className="font-semibold">{card.gameName}</span>
								{card.dayDisplay && (
									<span className="text-muted-foreground"> · {card.dayDisplay}</span>
								)}
							</p>
							<ResultCardSummary
								model={card}
								strings={resultCardStringsFrom((key) => tCard.raw(key) as string)}
								heading={tChallenge('theirs')}
							/>
						</div>
					)}

					<p className="mt-6 text-center text-[15px] text-muted-foreground">
						{target.sameAsShared ? t('bodySame') : t('bodyOther')}
					</p>
					<Link
						href={playHref}
						className="pressable mt-5 flex h-12 w-full items-center justify-center rounded-full bg-cta px-6 text-[16px] font-bold text-cta-foreground shadow-[inset_0_-3px_0_var(--color-cta-edge)] transition-colors hover:bg-cta-hover"
					>
						{tHome('playToday', { game: playName })}
					</Link>
					<p className="mt-3 text-center text-xs text-muted-foreground">{t('note')}</p>
				</div>
			</div>
		</main>
	)
}
