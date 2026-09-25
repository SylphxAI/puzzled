import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Suspense } from 'react'
import { GamePageContent } from '@/features/catalog/components/game-page-content'
import { GamePageHero } from '@/features/catalog/components/game-page-hero'
import { readMessage, relatedCatalogSlugs } from '@/features/catalog/lib/catalog'
import { parseGameFaq, parseGameTips, requireGamePage } from '@/features/catalog/lib/game-page'
import { resolveGameDayRequest } from '@/features/daily/lib/day-request'
import { gameSupportsDifficulty, getAllGameMetadata, getGameSlugs } from '@/games/registry'
import type { PuzzleDifficulty } from '@/games/types'
import { PUZZLE_DIFFICULTY_VALUES } from '@/games/types'
import { getTodaysFreeGame } from '@/lib/free-rotation'
import { canonicalizeGameSlug, slugToCamelCase } from '@/lib/game-slug'
import { difficultyLabelKey } from '@/lib/i18n/difficulty'
import { currentUser } from '@/lib/identity/server'
import { buildPageMetadata, ogImagePath } from '@/lib/seo/metadata'
import { GamePlayArea } from './game-play-area'
import { GamePlaySkeleton } from './game-play-skeleton'

// Force dynamic rendering - puzzle data must be fresh
export const dynamic = 'force-dynamic'

type Props = {
	params: Promise<{ locale: string; slug: string }>
	searchParams: Promise<{ mode?: string; date?: string; difficulty?: string }>
}

export async function generateStaticParams() {
	// Use all locales from config and all games from registry (SSOT)
	const { locales } = await import('@/lib/i18n/config')
	const gameSlugs = getGameSlugs()
	return locales.flatMap((locale) => gameSlugs.map((slug) => ({ locale, slug })))
}

/**
 * Module metadata.
 *
 * The registry decides whether the slug exists: an unregistered slug is turned
 * into a real 404 here, so `/games/<unknown>` answers with the not-found
 * document instead of a 200 shell that only renders the loading fallback. The
 * canonical module slug also owns the canonical URL, so an inbound alias never
 * competes with the module it resolves to.
 */
export async function generateMetadata({ params }: Props) {
	const { locale, slug } = await params
	const page = requireGamePage(slug)
	const tGames = await getTranslations({ locale, namespace: 'games' })
	const tCatalog = await getTranslations({ locale, namespace: 'catalog' })

	const translationKey = slugToCamelCase(page.slug)
	const gameName = readMessage(tGames, `${translationKey}.name`, page.metadata.name)
	const gameTagline = readMessage(tGames, `${translationKey}.tagline`, '')
	const gameDescription = readMessage(
		tGames,
		`${translationKey}.description`,
		page.metadata.description,
	)

	return buildPageMetadata({
		locale,
		path: `/games/${page.slug}`,
		title: gameName,
		description: [gameTagline, gameDescription].filter(Boolean).join(' — '),
		imagePath: ogImagePath({
			title: gameName,
			subtitle: gameTagline,
			eyebrow: tCatalog(`category.${page.metadata.category}`),
			theme: page.metadata.display.theme,
		}),
	})
}

/**
 * Module landing page (`/games/<slug>`).
 *
 * A `?date=` deep link (the shared card) is an archive read for the day it
 * names, with or without `mode=archive`; a request that names no past day is
 * today's ritual. The registry guard runs first, before any Suspense boundary,
 * so an unknown slug is a 404 with no rendered shell. Everything else is server-rendered for
 * every viewer — hero, rules, tips, FAQ and related modules — while the
 * interactive part streams behind a skeleton. Every module is open to every
 * player, guests included.
 */
export default async function GamePage({ params, searchParams }: Props) {
	const { locale, slug } = await params
	const { mode: modeParam, date: dateParam, difficulty: difficultyParam } = await searchParams
	setRequestLocale(locale)

	// Registry SSOT: canonical slug + module metadata, or a real 404.
	const page = requireGamePage(slug)
	const canonicalSlug = page.slug
	const moduleMetadata = page.metadata

	// Which product day this request is for. A dated deep link (the shared
	// card) resolves the day it names, so a recipient lands on the shared day
	// rather than today's board; today, the future and malformed days stay
	// today's ritual. Serve, entitlement and the one-finish guard stay in
	// Connect — this only picks the day to ask for.
	const { mode, puzzleDate } = resolveGameDayRequest({ mode: modeParam, date: dateParam })

	// Check if game supports difficulty and validate difficulty parameter
	const supportsDifficulty = gameSupportsDifficulty(canonicalSlug)
	const difficulty: PuzzleDifficulty | undefined = supportsDifficulty
		? PUZZLE_DIFFICULTY_VALUES.includes(difficultyParam as PuzzleDifficulty)
			? (difficultyParam as PuzzleDifficulty)
			: undefined
		: undefined

	const tGames = await getTranslations('games')
	const tCatalog = await getTranslations('catalog')
	const tCommon = await getTranslations()

	// Get user
	const user = await currentUser()

	// Get game name from translations using SSOT pattern
	const translationKey = slugToCamelCase(canonicalSlug)
	const gameName = readMessage(tGames, `${translationKey}.name`, moduleMetadata.name)
	const gameDescription = readMessage(
		tGames,
		`${translationKey}.description`,
		moduleMetadata.description,
	)
	const gameHighlight = readMessage(tGames, `${translationKey}.highlight`, '')
	const difficultyLabels =
		moduleMetadata.supportsDifficulty && moduleMetadata.difficultyLevels
			? moduleMetadata.difficultyLevels.map((level) =>
					readMessage(tCommon, difficultyLabelKey(level.level), level.level),
				)
			: []

	// Readable module content, server-rendered for every viewer.
	const rulesKey = `${translationKey}.rules`
	const rulesSource = tGames.has(rulesKey) ? tGames.raw(rulesKey) : null
	const rules =
		rulesSource && typeof rulesSource === 'object'
			? Object.entries(rulesSource as Record<string, unknown>).flatMap(([key, value]) =>
					key !== 'title' && typeof value === 'string' && value.trim() ? [value] : [],
				)
			: []
	const tipsKey = `game.${canonicalSlug}.tips`
	const faqKey = `game.${canonicalSlug}.faq`
	const tips = parseGameTips(tCatalog.has(tipsKey) ? tCatalog.raw(tipsKey) : null)
	const faq = parseGameFaq(tCatalog.has(faqKey) ? tCatalog.raw(faqKey) : null)
	const relatedSlugs = relatedCatalogSlugs({
		slug: canonicalSlug,
		modules: getAllGameMetadata(),
	})

	const todaysFreeGame = canonicalizeGameSlug(getTodaysFreeGame())

	return (
		<main className="flex-1">
			<GamePageHero
				slug={canonicalSlug}
				locale={locale}
				name={gameName}
				description={gameDescription}
				highlight={gameHighlight}
				difficultyLabels={difficultyLabels}
				duration={moduleMetadata.display.duration}
				theme={moduleMetadata.display.theme}
				category={moduleMetadata.category}
				freeToday={canonicalSlug === todaysFreeGame}
				isGuest={!user}
			/>

			<div id="play" className="page-shell py-6 md:py-8">
				<Suspense fallback={<GamePlaySkeleton />}>
					<GamePlayArea
						slug={canonicalSlug}
						locale={locale}
						gameName={gameName}
						mode={mode}
						difficulty={difficulty}
						supportsDifficulty={supportsDifficulty}
						hasUser={Boolean(user)}
						dateParam={puzzleDate}
					/>
				</Suspense>
			</div>

			<GamePageContent
				name={gameName}
				rules={rules}
				tips={tips}
				faq={faq}
				relatedSlugs={relatedSlugs}
				freeGameSlug={todaysFreeGame}
			/>
		</main>
	)
}
