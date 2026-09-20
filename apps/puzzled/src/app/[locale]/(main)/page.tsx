import { getTranslations, setRequestLocale } from 'next-intl/server'
import { cache, Suspense } from 'react'
import { summarizeDailyProgress } from '@/features/daily/lib/daily-progress'
import { deriveHomeExposure, HOME_EXPOSURE_LIMIT } from '@/features/daily/lib/home-exposure'
import { deriveHomePlayState, scopeHomePlayState } from '@/features/daily/lib/home-play-state'
import {
	HomeHero,
	HomeHeroFallback,
	type HomeHeroGame,
	HomeHeroSkeleton,
} from '@/features/home/components/home-hero'
import {
	FinalCta,
	HowItWorks,
	MemberStatsBand,
	TomorrowBand,
	ValueStrip,
} from '@/features/home/components/home-sections'
import {
	type LineupEntry,
	TodayLineup,
	TodayLineupSkeleton,
} from '@/features/home/components/today-lineup'
import { HOME_FAQ_KEYS, HOME_FAQ_NAMESPACE } from '@/features/home/lib/home-faq'
import { MarketingFaq } from '@/features/marketing/components'
import { getAllGameMetadata } from '@/games/registry'
import {
	getServerPersonalDailyResults,
	getServerStreakInfo,
	getServerTodayOverview,
	hasServerProgressIdentity,
	type PersonalDailyResult,
	type StreakInfo,
} from '@/lib/api/server'
import { getFreeGameRotation, getTodaysFreeGame, hasPremiumAccess } from '@/lib/billing/server'
import { slugToCamelCase } from '@/lib/game-slug'
import { currentUser, type IdentityUser } from '@/lib/identity/server'
import { withPresentationDeadline } from '@/lib/presentation-document'
import { PRODUCT_DAY_TZ, productDayKey } from '@/lib/product-day'
import { buildPageMetadata, ogImagePath } from '@/lib/seo/metadata'

type Props = {
	params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props) {
	const { locale } = await params
	const t = await getTranslations({ locale, namespace: 'home' })

	return buildPageMetadata({
		locale,
		path: '/',
		title: t('metaTitle'),
		description: t('metaDescription'),
		imagePath: ogImagePath({
			title: t('metaTitle'),
			subtitle: t('hero.guestTitle'),
			eyebrow: t('hero.ogEyebrow'),
			badge: t('hero.ogBadge'),
		}),
	})
}

/** Product day (Asia/Hong_Kong) written for the viewer's locale. */
function formatProductDay(date: Date, locale: string): string {
	return new Intl.DateTimeFormat(locale, {
		weekday: 'long',
		month: 'long',
		day: 'numeric',
		timeZone: PRODUCT_DAY_TZ,
	}).format(date)
}

type HomeFacts = {
	user: IdentityUser | null
	/** True when this viewer has progress Identity can own (session or guest id). */
	hasIdentity: boolean
	isPremium: boolean
	streakInfo: StreakInfo | null
	personalResults: Record<string, PersonalDailyResult>
	/** null until the aggregate read lands: an unread count is never a zero. */
	todayPlayerCount: number | null
}

/**
 * Personal and social reads for the home page.
 *
 * This is the only part of home that touches Connect or Identity. Both streamed
 * islands below read it through React `cache()`, so it costs one round of calls
 * per request and the document shell never waits for it.
 */
const readHomeFacts = cache(async (): Promise<HomeFacts> => {
	const user = await withPresentationDeadline(currentUser(), null)

	// Entitlement comes from the billing authority; a read failure stays free.
	const isPremium = user?.id
		? await withPresentationDeadline(hasPremiumAccess(user.id), false)
		: false

	const gameSlugs = getAllGameMetadata().map((game) => game.slug)
	const hasIdentity = Boolean(user) || (await hasServerProgressIdentity())

	const [overviewResult, streakResult, personalResult] = await Promise.allSettled([
		getServerTodayOverview(),
		hasIdentity ? getServerStreakInfo() : Promise.resolve(null),
		getServerPersonalDailyResults({
			gameSlugs,
			isGuest: !user,
			isPremium,
			freeGameSlug: getTodaysFreeGame(),
		}),
	])

	let todayPlayerCount: number | null = null
	if (overviewResult.status === 'fulfilled') {
		todayPlayerCount = overviewResult.value.playerCount
	} else {
		console.error('[HomePage] Failed to fetch today overview:', overviewResult.reason)
	}

	let streakInfo: StreakInfo | null = null
	if (streakResult.status === 'fulfilled') {
		streakInfo = streakResult.value
	} else {
		console.error('[HomePage] Failed to fetch streak info:', streakResult.reason)
	}

	let personalResults: Record<string, PersonalDailyResult>
	if (personalResult.status === 'fulfilled') {
		personalResults = personalResult.value
	} else {
		personalResults = Object.fromEntries(
			gameSlugs.map((slug) => [
				slug,
				{ hasCompleted: false, completedSession: null, statusAvailable: false },
			]),
		)
		console.error('[HomePage] Failed to fetch personal daily results:', personalResult.reason)
	}

	return { user, hasIdentity, isPremium, streakInfo, personalResults, todayPlayerCount }
})

type GameCatalogEntry = ReturnType<typeof getAllGameMetadata>[number]

/**
 * Home exposure stays small: today's free ritual leads, proved completions
 * follow, the remaining slots rotate per product day. Every other module stays
 * reachable on /games.
 *
 * Personal completion is best-effort: an unverified status never renders as a
 * completed state or a score, and the free ritual stays playable.
 */
function deriveHomeView(input: {
	gameMetadata: readonly GameCatalogEntry[]
	personalResults: Record<string, PersonalDailyResult>
	isPremium: boolean
	freeGameSlug: string
}) {
	const exposure = deriveHomeExposure({
		modules: input.gameMetadata.map((game) => ({ slug: game.slug, sortOrder: game.sortOrder })),
		freeGameSlug: input.freeGameSlug,
		completions: input.personalResults,
		dayKey: productDayKey(),
		limit: HOME_EXPOSURE_LIMIT,
	})
	const playState = deriveHomePlayState({
		gameSlugs: input.gameMetadata.map((game) => game.slug),
		personalResults: input.personalResults,
		isPremium: input.isPremium,
		freeGameSlug: input.freeGameSlug,
	})
	const { renderedGames, progressGames } = scopeHomePlayState(playState, exposure.slugs)
	return {
		renderedGames,
		progress: summarizeDailyProgress(progressGames),
		progressUnverified: playState.hasUnverifiedStatus,
	}
}

type LineupTranslator = (key: string) => string

/** Lineup cards for the exposed slugs, in exposure order. */
function buildLineup(input: {
	renderedGames: ReturnType<typeof deriveHomeView>['renderedGames']
	metadataBySlug: Map<string, GameCatalogEntry>
	t: LineupTranslator
}): LineupEntry[] {
	return input.renderedGames.flatMap((game) => {
		const metadata = input.metadataBySlug.get(game.slug)
		if (!metadata) return []
		const camel = slugToCamelCase(game.slug)
		const status = game.isFreeToday ? 'free' : game.completed ? 'solved' : 'premium'
		return [
			{
				slug: game.slug,
				name: input.t(`games.${camel}.name`),
				tagline: input.t(`games.${camel}.tagline`),
				meta: [metadata.display.duration, input.t(`games.${camel}.highlight`)]
					.filter(Boolean)
					.join(' • '),
				theme: metadata.display.theme,
				status: status as LineupEntry['status'],
				score: game.score ?? null,
			},
		]
	})
}

/** Streamed hero: personal headline, streak chip, progress ring, social proof. */
async function HomeHeroIsland({
	locale,
	dateLabel,
	freeGame,
}: {
	locale: string
	dateLabel: string
	freeGame: HomeHeroGame
}) {
	const facts = await readHomeFacts()
	const view = deriveHomeView({
		gameMetadata: getAllGameMetadata(),
		personalResults: facts.personalResults,
		isPremium: facts.isPremium,
		freeGameSlug: freeGame.slug,
	})

	return (
		<HomeHero
			locale={locale}
			dateLabel={dateLabel}
			freeGame={freeGame}
			isMember={Boolean(facts.user)}
			currentStreak={facts.streakInfo?.currentStreak ?? 0}
			hasPlayedToday={facts.streakInfo?.hasPlayedToday ?? false}
			completedCount={view.progress.completedCount}
			availableCount={view.progress.availableCount}
			playerCount={facts.todayPlayerCount}
			// Only warn about unread progress when this viewer has progress to
			// read: a brand-new guest has none, and a warning would be noise.
			progressUnverified={view.progressUnverified && facts.hasIdentity}
		/>
	)
}

/** Streamed lineup: proved finishes, scores and the member stats band. */
async function HomeLineupIsland({
	freeGameSlug,
	metadataBySlug,
}: {
	freeGameSlug: string
	metadataBySlug: Map<string, GameCatalogEntry>
}) {
	const [t, facts] = await Promise.all([getTranslations(), readHomeFacts()])
	const view = deriveHomeView({
		gameMetadata: getAllGameMetadata(),
		personalResults: facts.personalResults,
		isPremium: facts.isPremium,
		freeGameSlug,
	})
	const lineup = buildLineup({
		renderedGames: view.renderedGames,
		metadataBySlug,
		t: t as LineupTranslator,
	})

	return (
		<>
			<TodayLineup games={lineup} showUnlock={!facts.isPremium} />
			{facts.user ? (
				<MemberStatsBand
					currentStreak={facts.streakInfo?.currentStreak ?? 0}
					bestStreak={facts.streakInfo?.maxStreak ?? 0}
					totalGamesPlayed={facts.streakInfo?.totalGamesPlayed ?? 0}
				/>
			) : (
				<ValueStrip />
			)}
		</>
	)
}

export default async function HomePage({ params }: Props) {
	const { locale } = await params
	setRequestLocale(locale)

	// Only network-free work happens before the first flush: the shell, the hero
	// and the evergreen sections stream as soon as they are rendered, and the
	// identity/Connect reads land in the islands below.
	const t = await getTranslations()
	const tHome = await getTranslations('home')
	// Cookie-only read (no network): does this viewer have progress we owe them a
	// placeholder for, rather than guest copy that may be wrong for a member?
	const hasProgressIdentity = await hasServerProgressIdentity()
	const todaysFreeGame = getTodaysFreeGame()
	const freeGameRotation = getFreeGameRotation()
	const todayIndex = freeGameRotation.indexOf(todaysFreeGame)
	const tomorrowsFreeGame = freeGameRotation[(todayIndex + 1) % freeGameRotation.length]

	const gameMetadata = getAllGameMetadata()
	const metadataBySlug = new Map(gameMetadata.map((game) => [game.slug, game]))

	const freeGameMeta = metadataBySlug.get(todaysFreeGame)
	const freeGameName = freeGameMeta
		? t(`games.${slugToCamelCase(todaysFreeGame)}.name`)
		: todaysFreeGame
	const freeGame: HomeHeroGame = {
		slug: todaysFreeGame,
		name: freeGameName,
		tagline: freeGameMeta
			? t(`games.${slugToCamelCase(todaysFreeGame)}.tagline`)
			: tHome('lineup.premium'),
		duration: freeGameMeta?.display.duration ?? '',
		highlight: freeGameMeta ? t(freeGameMeta.display.highlightKey) : '',
		theme: freeGameMeta?.display.theme ?? 'violet',
		difficultyLabels:
			freeGameMeta?.supportsDifficulty && freeGameMeta.difficultyLevels
				? freeGameMeta.difficultyLevels.map((level) =>
						t(`games.${slugToCamelCase(todaysFreeGame)}.difficulty.${level.level}`),
					)
				: [],
	}

	// Rotation-only fallback: no completions are known yet, so nothing here can
	// claim a finish or a score. It is exactly what a first-time visitor sees.
	const rotationView = deriveHomeView({
		gameMetadata,
		personalResults: {},
		isPremium: false,
		freeGameSlug: todaysFreeGame,
	})
	const rotationLineup = buildLineup({
		renderedGames: rotationView.renderedGames,
		metadataBySlug,
		t: t as LineupTranslator,
	})

	const tomorrowsFreeGameName = metadataBySlug.get(tomorrowsFreeGame)
		? t(`games.${slugToCamelCase(tomorrowsFreeGame)}.name`)
		: tomorrowsFreeGame

	return (
		<main className="flex-1">
			<Suspense
				fallback={
					hasProgressIdentity ? (
						// Personal numbers are owed but unread: claim nothing, keep the
						// geometry (`HomeHeroSkeleton`).
						<HomeHeroSkeleton />
					) : (
						// A first-time visitor sees the real guest hero immediately — the
						// same thing the island below renders for them, so nothing swaps.
						<HomeHeroFallback
							locale={locale}
							dateLabel={formatProductDay(new Date(), locale)}
							freeGame={freeGame}
						/>
					)
				}
			>
				<HomeHeroIsland
					locale={locale}
					dateLabel={formatProductDay(new Date(), locale)}
					freeGame={freeGame}
				/>
			</Suspense>

			<div
				className="animate-enter pt-8"
				style={{ '--enter-delay': '80ms' } as React.CSSProperties}
			>
				<Suspense
					fallback={
						hasProgressIdentity ? (
							<TodayLineupSkeleton />
						) : (
							<TodayLineup games={rotationLineup} showUnlock />
						)
					}
				>
					<HomeLineupIsland freeGameSlug={todaysFreeGame} metadataBySlug={metadataBySlug} />
				</Suspense>
				<TomorrowBand gameName={tomorrowsFreeGameName} />
			</div>

			{/* MUTATION (throwaway): a control with no accessible name */}
			<button type="button" className="rounded-full border border-border p-3">
				<span aria-hidden="true">🔍</span>
			</button>

			<HowItWorks />
			<MarketingFaq
				id="home-faq"
				title={tHome('faq.title')}
				subtitle={tHome('faq.subtitle')}
				itemsFrom="namespace"
				namespace={HOME_FAQ_NAMESPACE}
				keys={HOME_FAQ_KEYS}
			/>
			<FinalCta
				freeGameSlug={todaysFreeGame}
				freeGameName={freeGameName}
				gameCount={gameMetadata.length}
			/>
		</main>
	)
}
