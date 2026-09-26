import { Clock, Play } from 'lucide-react'
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
	/** Today's featured free-rotation module. */
	freeToday: boolean
	/** No account on this request; sign-in keeps the streak. */
	isGuest: boolean
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
				isAccessibleForFree: true,
			},
		],
	}

	return (
		<section className={cn('relative text-[#1a1712]', colors.bg)}>
			<div className="page-shell-wide pb-8 pt-4 md:pb-12 md:pt-6">
				<nav aria-label={t('breadcrumbLabel')} className="text-[13px] text-[#1a1712]/70">
					<ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
						<li>
							<Link href="/" className="inline-flex min-h-11 items-center hover:text-[#1a1712]">
								{tNav('home')}
							</Link>
						</li>
						<li aria-hidden="true">/</li>
						<li>
							<Link
								href="/games"
								className="inline-flex min-h-11 items-center hover:text-[#1a1712]"
							>
								{t('title')}
							</Link>
						</li>
						<li aria-hidden="true">/</li>
						<li aria-current="page" className="font-semibold text-[#1a1712]">
							{name}
						</li>
					</ol>
				</nav>

				<div className="mt-2 grid items-center gap-6 md:grid-cols-[1fr_auto] md:gap-12">
					<div className="min-w-0">
						{freeToday ? (
							<span className="inline-flex rounded-full bg-[#1a1712] px-2.5 py-1 text-xs font-semibold text-[#fbf9f4]">
								{t('freeToday')}
							</span>
						) : null}
						<h1 className="mt-3 font-display text-[2.5rem] leading-[1.02] text-balance md:text-6xl">
							{name}
						</h1>
						<p className="mt-3 max-w-xl text-[17px] leading-relaxed text-[#1a1712]/80">
							{description}
						</p>

						<ul className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] font-medium text-[#1a1712]/75">
							<li className="inline-flex items-center gap-1">
								<Clock className="h-3.5 w-3.5" aria-hidden="true" />
								{duration}
							</li>
							{highlight ? (
								<li>
									<span aria-hidden="true">· </span>
									{highlight}
								</li>
							) : null}
							<li>
								<span aria-hidden="true">· </span>
								{t(`category.${category}`)}
							</li>
							{difficultyLabels.length > 0 ? (
								<li>
									<span aria-hidden="true">· </span>
									{difficultyLabels.join(' / ')}
								</li>
							) : null}
						</ul>

						<div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
							<a
								href="#play"
								className="pressable inline-flex h-12 items-center gap-2 rounded-full bg-[#1a1712] px-7 text-[16px] font-semibold text-[#fbf9f4] transition-opacity hover:opacity-90"
							>
								<Play className="h-4 w-4" fill="currentColor" aria-hidden="true" />
								{t('gamePage.playCta')}
							</a>
							{freeToday ? (
								<p className="text-sm text-[#1a1712]/75">{t('gamePage.freeNote')}</p>
							) : null}
						</div>

						{isGuest && (
							<p className="mt-3 text-sm text-[#1a1712]/75">
								{t('gamePage.guestNote')}{' '}
								<Link
									href={`/login?callbackUrl=/games/${slug}`}
									className="font-semibold text-[#1a1712] underline underline-offset-4"
								>
									{t('gamePage.guestSignIn')}
								</Link>
							</p>
						)}
					</div>

					<div
						className={cn(
							'hidden h-48 w-48 items-center justify-center rounded-[2.5rem] bg-white/35 md:flex lg:h-60 lg:w-60',
							colors.onField,
						)}
						aria-hidden="true"
					>
						<GameIcon slug={slug} size={112} />
					</div>
				</div>
			</div>

			<script
				type="application/ld+json"
				// biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD with trusted registry and translation content
				dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
			/>
		</section>
	)
}
