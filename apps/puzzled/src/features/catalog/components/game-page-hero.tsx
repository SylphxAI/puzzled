import { Clock } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { type GameColorTheme, getGameColors } from '@/games/theme-colors'
import type { GameCategory } from '@/games/types'
import { Link } from '@/lib/i18n/routing'
import { localizedPath } from '@/lib/seo/metadata'
import { getCanonicalSiteOrigin } from '@/lib/site-origin.server'
import { cn } from '@/lib/utils'
import { GameMotif } from '@/shared/components/games/game-motif'
import { HeroGuestNote } from './hero-guest-note'
import { HeroPlayAction } from './hero-play-action'

type GamePageHeroProps = {
	slug: string
	locale: string
	/** Player-facing module name (`games.<camel>.name`). */
	name: string
	/** One-line description of the puzzle (`games.<camel>.description`). */
	description: string
	/** Registry highlight, e.g. "Classic puzzle". */
	highlight: string
	/** Human difficulty labels for modules that offer a choice. */
	difficultyLabels: readonly string[]
	duration: string
	theme: GameColorTheme
	category: GameCategory
	/** Today's featured free-rotation module. */
	freeToday: boolean
	/** No account on this request; sign-in keeps the streak. */
	isGuest: boolean
	/** Behind Tryit Plus for this viewer: the unlock panel owns the action. */
	locked: boolean
	/** Where the play button goes: today's started board, or `#play` on an archive day. */
	playHref: string
	/**
	 * `stage`: the player pressed Play and the board leads, so the hero is a
	 * slim title bar. `landing`: the game's own page, title and Play first.
	 */
	variant?: 'landing' | 'stage'
}

/**
 * Game page hero: breadcrumb, the page's only h1, the module facts and the
 * play action. Every module is open to every player; the hero is
 * server-rendered for every viewer.
 */
export async function GamePageHero({
	slug,
	locale,
	name,
	description,
	highlight,
	difficultyLabels,
	duration,
	theme,
	category,
	freeToday,
	isGuest,
	locked,
	playHref,
	variant = 'landing',
}: GamePageHeroProps) {
	const t = await getTranslations('catalog')
	const tNav = await getTranslations('nav')
	const colors = getGameColors(theme)
	const origin = await getCanonicalSiteOrigin()
	const pageUrl = `${origin}${localizedPath(locale, `/games/${slug}`)}`

	const structuredData = {
		'@context': 'https://schema.org',
		'@graph': [
			{
				'@type': 'BreadcrumbList',
				itemListElement: [
					{
						'@type': 'ListItem',
						position: 1,
						name: tNav('home'),
						item: `${origin}${localizedPath(locale, '/')}`,
					},
					{
						'@type': 'ListItem',
						position: 2,
						name: t('title'),
						item: `${origin}${localizedPath(locale, '/games')}`,
					},
					{ '@type': 'ListItem', position: 3, name, item: pageUrl },
				],
			},
			{
				'@type': 'VideoGame',
				name,
				description,
				genre: t(`category.${category}`),
				playMode: 'SinglePlayer',
				publisher: { '@type': 'Organization', name: 'Tryit' },
				url: pageUrl,
				inLanguage: 'en',
				isAccessibleForFree: true,
			},
		],
	}

	const breadcrumb = (
		<nav aria-label={t('breadcrumbLabel')} className="text-[13px] text-muted-foreground">
			<ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
				<li>
					<Link href="/" className="inline-flex min-h-11 items-center hover:text-foreground">
						{tNav('home')}
					</Link>
				</li>
				<li aria-hidden="true">/</li>
				<li>
					<Link href="/games" className="inline-flex min-h-11 items-center hover:text-foreground">
						{t('title')}
					</Link>
				</li>
				<li aria-hidden="true">/</li>
				<li aria-current="page" className="font-semibold text-foreground">
					{name}
				</li>
			</ol>
		</nav>
	)
	const facts = (
		<ul className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-foreground">
			<li className="tag-chip numeral">
				<Clock className="h-3 w-3" aria-hidden="true" />
				{duration}
			</li>
			<li className="tag-chip">{t(`category.${category}`)}</li>
			{highlight ? <li className="tag-chip">{highlight}</li> : null}
			{difficultyLabels.length > 0 ? (
				<li className="tag-chip">{difficultyLabels.join(' / ')}</li>
			) : null}
		</ul>
	)
	const jsonLd = (
		<script
			type="application/ld+json"
			// biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD with trusted registry and translation content
			dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
		/>
	)

	if (variant === 'stage') {
		return (
			<section className="game-hero game-hero-stage relative border-b border-[var(--tactile-soft-line)]">
				<div className="page-shell flex items-center gap-3 pb-2 pt-1 md:gap-4">
					<div
						className={cn(
							'tactile-card hidden h-14 w-[5.5rem] shrink-0 overflow-hidden rounded-xl p-1 sm:block',
							colors.bg,
						)}
						aria-hidden="true"
					>
						<GameMotif slug={slug} zoom />
					</div>
					<div className="min-w-0 flex-1">
						{breadcrumb}
						<div className="-mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5 pb-1">
							<h1 className="font-display text-2xl leading-tight md:text-[1.75rem]">{name}</h1>
							{freeToday ? (
								<span className="inline-flex rounded-full bg-foreground px-2.5 py-0.5 text-xs font-semibold text-background">
									{t('freeToday')}
								</span>
							) : null}
							<div className="hidden md:block">{facts}</div>
						</div>
					</div>
				</div>
				{jsonLd}
			</section>
		)
	}

	return (
		<section className="game-hero relative border-b border-[var(--tactile-soft-line)]">
			<div className="page-shell-wide pb-8 pt-2 md:pb-10">
				{breadcrumb}
				<div className="mt-1 grid items-center gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] md:gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,27rem)]">
					<div className="min-w-0">
						{freeToday ? (
							<span className="inline-flex rounded-full bg-foreground px-2.5 py-1 text-xs font-semibold text-background">
								{t('freeToday')}
							</span>
						) : null}
						<h1 className="mt-3 font-display text-[2.5rem] leading-[1.02] text-balance md:text-6xl">
							{name}
						</h1>
						<p className="mt-3 max-w-xl text-[17px] leading-relaxed text-muted-foreground">
							{description}
						</p>
						<div className="mt-4">{facts}</div>

						<HeroPlayAction
							locked={locked}
							label={t('gamePage.playCta')}
							href={playHref}
							startIntent={slug}
						/>

						<HeroGuestNote isGuest={isGuest} locked={locked}>
							{t('gamePage.guestNote')}{' '}
							<Link
								href={{ pathname: '/signup', query: { callbackUrl: `/games/${slug}` } }}
								className="inline-flex min-h-11 items-center font-semibold text-foreground underline underline-offset-4"
							>
								{t('gamePage.guestSignIn')}
							</Link>
						</HeroGuestNote>
					</div>

					<div
						className={cn(
							'tactile-card hidden aspect-[16/10] overflow-hidden p-4 md:block',
							colors.bg,
						)}
						aria-hidden="true"
					>
						<GameMotif slug={slug} />
					</div>
				</div>
			</div>
			{jsonLd}
		</section>
	)
}
