import { getTranslations, setRequestLocale } from 'next-intl/server'
import { summarizeDailyProgress } from '@/features/daily/lib/daily-progress'
import { deriveHomeExposure, HOME_EXPOSURE_LIMIT } from '@/features/daily/lib/home-exposure'
import { deriveHomePlayState, scopeHomePlayState } from '@/features/daily/lib/home-play-state'
import { HomeFaq } from '@/features/home/components/home-faq'
import { HomeHero, type HomeHeroGame } from '@/features/home/components/home-hero'
import {
	FinalCta,
	HowItWorks,
	MemberStatsBand,
	TomorrowBand,
	ValueStrip,
} from '@/features/home/components/home-sections'
import { type LineupEntry, TodayLineup } from '@/features/home/components/today-lineup'
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
import { currentUser } from '@/lib/identity/server'
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
			eyebrow: 'Free daily puzzle',
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

export default async function HomePage({ params }: Props) {
	const { locale } = await params
	setRequestLocale(locale)

	const t = await getTranslations()
	const user = await withPresentationDeadline(currentUser(), null)

	// Entitlement comes from the billing authority; a read failure stays free.
	const isPremium = user?.id
		? await withPresentationDeadline(hasPremiumAccess(user.id), false)
		: false

	// Today's free ritual comes from the product-day rotation.
	const todaysFreeGame = getTodaysFreeGame()
	const freeGameRotation = getFreeGameRotation()
	const todayIndex = freeGameRotation.indexOf(todaysFreeGame)
	const tomorrowsFreeGame = freeGameRotation[(todayIndex + 1) % freeGameRotation.length]

	const gameMetadata = getAllGameMetadata()
	const metadataBySlug = new Map(gameMetadata.map((game) => [game.slug, game]))

	const hasIdentity = Boolean(user) || (await hasServerProgressIdentity())
	let streakInfo: StreakInfo | null = null
	let todayPlayerCount = 0
	const [overviewResult, streakResult, personalResult] = await Promise.allSettled([
		getServerTodayOverview(),
		hasIdentity ? getServerStreakInfo() : Promise.resolve(null),
		getServerPersonalDailyResults({
			gameSlugs: gameMetadata.map((game) => game.slug),
			isGuest: !user,
			isPremium,
			freeGameSlug: todaysFreeGame,
		}),
	])
	if (overviewResult.status === 'fulfilled') {
		todayPlayerCount = overviewResult.value.playerCount
	} else {
		console.error('[HomePage] Failed to fetch today overview:', overviewResult.reason)
	}
	if (streakResult.status === 'fulfilled') {
		streakInfo = streakResult.value
	} else {
		console.error('[HomePage] Failed to fetch streak info:', streakResult.reason)
	}
	const personalResults: Record<string, PersonalDailyResult> =
		personalResult.status === 'fulfilled'
			? personalResult.value
			: Object.fromEntries(
					gameMetadata.map((game) => [
						game.slug,
						{ hasCompleted: false, completedSession: null, statusAvailable: false },
					]),
				)
	if (personalResult.status === 'rejected') {
		console.error('[HomePage] Failed to fetch personal daily results:', personalResult.reason)
	}

	// Home exposure stays small: today's free ritual leads, proved completions
	// follow, the remaining slots rotate per product day. Every other module
	// stays reachable on /games.
	const exposure = deriveHomeExposure({
		modules: gameMetadata.map((game) => ({ slug: game.slug, sortOrder: game.sortOrder })),
		freeGameSlug: todaysFreeGame,
		completions: personalResults,
		dayKey: productDayKey(),
		limit: HOME_EXPOSURE_LIMIT,
	})

	// Personal completion is best-effort: an unverified status never renders as
	// a completed state or a score, and the free ritual stays playable.
	const playState = deriveHomePlayState({
		gameSlugs: gameMetadata.map((game) => game.slug),
		personalResults,
		isPremium,
		freeGameSlug: todaysFreeGame,
	})
	const { renderedGames, progressGames } = scopeHomePlayState(playState, exposure.slugs)
	const progress = summarizeDailyProgress(progressGames)

	const freeGameMeta = metadataBySlug.get(todaysFreeGame)
	const freeGameName = freeGameMeta
		? t(`games.${slugToCamelCase(todaysFreeGame)}.name`)
		: todaysFreeGame
	const freeGame: HomeHeroGame = {
		slug: todaysFreeGame,
		name: freeGameName,
		tagline: freeGameMeta
			? t(`games.${slugToCamelCase(todaysFreeGame)}.tagline`)
			: t('lineup.premium'),
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

	const lineup: LineupEntry[] = renderedGames.flatMap((game) => {
		const metadata = metadataBySlug.get(game.slug)
		if (!metadata) return []
		const camel = slugToCamelCase(game.slug)
		const status = game.isFreeToday ? 'free' : game.completed ? 'solved' : 'premium'
		return [
			{
				slug: game.slug,
				name: t(`games.${camel}.name`),
				tagline: t(`games.${camel}.tagline`),
				meta: [metadata.display.duration, t(`games.${camel}.highlight`)]
					.filter(Boolean)
					.join(' • '),
				theme: metadata.display.theme,
				status: status as LineupEntry['status'],
				score: game.score ?? null,
			},
		]
	})

	const tomorrowsFreeGameName = metadataBySlug.get(tomorrowsFreeGame)
		? t(`games.${slugToCamelCase(tomorrowsFreeGame)}.name`)
		: tomorrowsFreeGame

	const currentStreak = streakInfo?.currentStreak ?? 0
	const hasPlayedToday = streakInfo?.hasPlayedToday ?? false

	return (
		<main className="flex-1">
			<HomeHero
				locale={locale}
				dateLabel={formatProductDay(new Date(), locale)}
				freeGame={freeGame}
				isMember={Boolean(user)}
				currentStreak={currentStreak}
				hasPlayedToday={hasPlayedToday}
				completedCount={progress.completedCount}
				availableCount={progress.availableCount}
				playerCount={todayPlayerCount}
				progressUnverified={playState.hasUnverifiedStatus}
			/>

			<div
				className="animate-enter pt-8"
				style={{ '--enter-delay': '80ms' } as React.CSSProperties}
			>
				<TodayLineup games={lineup} showUnlock={!isPremium} />
				{user ? (
					<MemberStatsBand
						currentStreak={currentStreak}
						bestStreak={streakInfo?.maxStreak ?? 0}
						totalGamesPlayed={streakInfo?.totalGamesPlayed ?? 0}
					/>
				) : (
					<ValueStrip />
				)}
				<TomorrowBand gameName={tomorrowsFreeGameName} />
			</div>

			<HowItWorks />
			<HomeFaq />
			<FinalCta
				freeGameSlug={todaysFreeGame}
				freeGameName={freeGameName}
				gameCount={gameMetadata.length}
			/>
		</main>
	)
}
