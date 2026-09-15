import { Clock, Lock, Play, Sparkles } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { type GameColorTheme, getGameColors } from '@/games/theme-colors'
import type { GameCategory } from '@/games/types'
import { Link } from '@/lib/i18n/routing'
import { localizedPath } from '@/lib/seo/metadata'
import { getRequestSiteOrigin } from '@/lib/site-origin.server'
import { cn } from '@/lib/utils'
import { GameIcon } from '@/shared/components/ui/game-icons'

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
	/** Today's free-rotation module: playable by everyone. */
	freeToday: boolean
	/** The viewer can start this module today (free rotation or entitlement). */
	canPlay: boolean
	/** No account on this request; sign-in keeps the streak. */
	isGuest: boolean
	isPremium: boolean
}

/**
 * Game page hero: breadcrumb, the page's only h1, the module facts and the
 * action that matches what this viewer may actually do today. The hero is
 * server-rendered for every viewer, including the ones who cannot play yet.
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
	canPlay,
	isGuest,
	isPremium,
}: GamePageHeroProps) {
	const t = await getTranslations('catalog')
	const tNav = await getTranslations('nav')
	const colors = getGameColors(theme)
	const origin = await getRequestSiteOrigin()
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
				publisher: { '@type': 'Organization', name: 'Puzzled' },
				url: pageUrl,
				inLanguage: 'en',
				isAccessibleForFree: freeToday,
			},
		],
	}

	return (
		<section className="relative overflow-hidden border-b border-border/60 bg-aurora">
			<div className="page-shell-wide pb-8 pt-6 md:pb-10 md:pt-10">
				<nav aria-label={t('breadcrumbLabel')} className="text-sm text-muted-foreground">
					<ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
						<li>
							<Link href="/" className="transition-colors hover:text-foreground">
								{tNav('home')}
							</Link>
						</li>
						<li aria-hidden="true">/</li>
						<li>
							<Link href="/games" className="transition-colors hover:text-foreground">
								{t('title')}
							</Link>
						</li>
						<li aria-hidden="true">/</li>
						<li aria-current="page" className="font-semibold text-foreground">
							{name}
						</li>
					</ol>
				</nav>

				<div className="mt-5 flex items-start gap-4">
					<span
						className={cn(
							'flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-md',
							colors.gradient,
						)}
					>
						<GameIcon slug={slug} size={28} />
					</span>
					<div className="min-w-0">
						{freeToday ? (
							<span className="chip bg-emerald-500/12 text-emerald-600 dark:text-emerald-400">
								<Sparkles className="h-3 w-3" aria-hidden="true" />
								{t('freeToday')}
							</span>
						) : (
							<span className="chip bg-muted text-muted-foreground">
								<Lock className="h-3 w-3" aria-hidden="true" />
								{t('premium')}
							</span>
						)}
						<h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-balance md:text-4xl">
							{name}
						</h1>
						<p className="mt-2 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
							{description}
						</p>
					</div>
				</div>

				<div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
					<span className="chip bg-background/80 text-muted-foreground">
						<Clock className="h-3 w-3" aria-hidden="true" />
						{duration}
					</span>
					<span className={cn('chip bg-background/80', colors.text)}>{highlight}</span>
					<span className="chip bg-background/80 text-muted-foreground">
						{t(`category.${category}`)}
					</span>
					{difficultyLabels.map((label) => (
						<span key={label} className="chip bg-background/80 text-muted-foreground">
							{label}
						</span>
					))}
				</div>

				{canPlay ? (
					<div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
						<a
							href="#play"
							className={cn(
								'inline-flex h-12 items-center gap-2 rounded-2xl bg-gradient-to-br px-6 font-semibold text-white shadow-md transition-transform hover:-translate-y-0.5 active:scale-[0.99]',
								colors.gradient,
							)}
						>
							<Play className="h-4 w-4" aria-hidden="true" />
							{t('gamePage.playCta')}
						</a>
						<p className="text-sm text-muted-foreground">
							{freeToday ? t('gamePage.freeNote') : isPremium ? t('gamePage.includedNote') : null}
						</p>
					</div>
				) : (
					<p className="mt-5 max-w-2xl text-sm text-muted-foreground">{t('gamePage.lockedNote')}</p>
				)}

				{isGuest && canPlay && (
					<p className="mt-3 text-sm text-muted-foreground">
						{t('gamePage.guestNote')}{' '}
						<Link
							href={`/login?callbackUrl=/games/${slug}`}
							className="font-semibold text-primary hover:underline"
						>
							{t('gamePage.guestSignIn')}
						</Link>
					</p>
				)}
			</div>

			<script
				type="application/ld+json"
				// biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD with trusted registry and translation content
				dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
			/>
		</section>
	)
}
