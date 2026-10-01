import { getTranslations } from 'next-intl/server'
import {
	landingPlayTarget,
	type SharedResult,
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

type SharedResultLandingProps = {
	shared: SharedResult
	shareId: string
	locale: string
}

/**
 * The page a shared link opens: the sharer's non-spoiler result above a plain
 * invitation to play today's puzzle. It shows no name, no solution and no
 * countdown; a result from an earlier day says so and still offers today.
 */
export async function SharedResultLanding({ shared, shareId, locale }: SharedResultLandingProps) {
	const t = await getTranslations({ locale, namespace: 'share.landing' })
	const tGames = await getTranslations({ locale, namespace: 'games' })
	const tChallenge = await getTranslations({ locale, namespace: 'share.challenge' })
	const tHome = await getTranslations({ locale, namespace: 'home.day' })
	const tCard = await getTranslations({ locale, namespace: 'share.card' })
	const today = { dayKey: productDayKey(), freeGameSlug: getTodaysFreeGame() }
	const target = landingPlayTarget(shared, today)
	const card = sharedResultCard(shared, {
		origin: getBaseUrl('origin'),
		gameName: resolveModuleDisplayName(tGames, shared.gameSlug),
		theme: getHowToPlayConfig(shared.gameSlug)?.display.theme ?? 'slate',
		locale,
	})
	const playName = resolveModuleDisplayName(tGames, target.gameSlug)

	return (
		<main className="flex-1">
			{target.sameAsShared && (
				<ChallengeMemoryWriter
					shareId={shareId}
					gameSlug={shared.gameSlug}
					dayKey={shared.dayKey}
				/>
			)}
			<div className="page-shell py-10 md:py-16">
				<div className="mx-auto w-full max-w-md">
					<p className="text-center text-sm font-medium text-muted-foreground">{t('eyebrow')}</p>
					<h1 className="mt-2 text-balance text-center font-display text-[2rem] leading-tight md:text-4xl">
						{target.sameAsShared ? t('titleSame') : t('titleOther')}
					</h1>

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

					<p className="mt-6 text-center text-[15px] text-muted-foreground">
						{target.sameAsShared ? t('bodySame') : t('bodyOther')}
					</p>
					<Link
						href={`/games/${target.gameSlug}`}
						className="pressable mt-5 flex h-12 w-full items-center justify-center rounded-full bg-primary px-6 text-[16px] font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
					>
						{tHome('playToday', { game: playName })}
					</Link>
					<p className="mt-3 text-center text-xs text-muted-foreground">{t('note')}</p>
				</div>
			</div>
		</main>
	)
}
