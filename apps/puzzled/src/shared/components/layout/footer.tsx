import { getTranslations } from 'next-intl/server'
import { getAllGameMetadata } from '@/games/registry'
import { SUPPORT_EMAIL } from '@/lib/config/app'
import { slugToCamelCase } from '@/lib/game-slug'
import { Link } from '@/lib/i18n/routing'
import { LanguageSwitcher } from './language-switcher'
import { Logo } from './logo'

const FOOTER_GAME_LIMIT = 8

/**
 * Site footer.
 *
 * Server rendered: it carries the internal link graph search engines follow
 * (every game, the catalog, pricing, support, legal) and the language entry
 * point, so it stays on every crawled page.
 */
export async function Footer() {
	const t = await getTranslations('footer')
	const tNav = await getTranslations('nav')
	const tGame = await getTranslations()
	const games = getAllGameMetadata().slice(0, FOOTER_GAME_LIMIT)
	const currentYear = new Date().getFullYear()

	return (
		<footer className="mt-auto surface-ink">
			<div className="page-shell-wide py-12 md:py-16">
				<div className="grid gap-10 md:grid-cols-[1.3fr_1fr_1fr_1fr]">
					<div>
						<Logo size="md" tone="inverse" />
						<p className="mt-4 max-w-xs text-sm leading-relaxed text-white/70">{t('tagline')}</p>
						<div className="mt-5">
							<LanguageSwitcher variant="button" tone="inverse" />
						</div>
					</div>

					<nav aria-label={t('playHeading')} className="text-sm">
						<h2 className="font-display text-sm font-bold text-white">{t('playHeading')}</h2>
						{/*
						 * Each footer destination owns a 44px target (company bar, WCAG
						 * 2.5.8 friendly): the link carries the height and the list drops
						 * the extra gap so the column does not double-space.
						 */}
						<ul className="mt-3 space-y-0">
							{games.map((game) => (
								<li key={game.slug}>
									<Link
										href={`/games/${game.slug}`}
										className="-mx-2 inline-flex min-h-11 min-w-11 items-center px-2 text-white/70 transition-colors hover:text-white"
									>
										{tGame(`games.${slugToCamelCase(game.slug)}.name`)}
									</Link>
								</li>
							))}
							<li>
								<Link
									href="/games"
									className="-mx-2 inline-flex min-h-11 min-w-11 items-center px-2 font-semibold text-white/90 transition-colors hover:text-white"
								>
									{t('allGames')} →
								</Link>
							</li>
						</ul>
					</nav>

					<nav aria-label={t('productHeading')} className="text-sm">
						<h2 className="font-display text-sm font-bold text-white">{t('productHeading')}</h2>
						<ul className="mt-3 space-y-0">
							<li>
								<Link
									href="/pricing"
									className="-mx-2 inline-flex min-h-11 min-w-11 items-center px-2 text-white/70 transition-colors hover:text-white"
								>
									{tNav('pricing')}
								</Link>
							</li>
							<li>
								<Link
									href="/stats"
									className="-mx-2 inline-flex min-h-11 min-w-11 items-center px-2 text-white/70 transition-colors hover:text-white"
								>
									{tNav('stats')}
								</Link>
							</li>
							<li>
								<Link
									href="/leaderboard"
									className="-mx-2 inline-flex min-h-11 min-w-11 items-center px-2 text-white/70 transition-colors hover:text-white"
								>
									{tNav('leaderboard')}
								</Link>
							</li>
							<li>
								<Link
									href="/support"
									className="-mx-2 inline-flex min-h-11 min-w-11 items-center px-2 text-white/70 transition-colors hover:text-white"
								>
									{tNav('support')}
								</Link>
							</li>
						</ul>
					</nav>

					<nav aria-label={t('legalHeading')} className="text-sm">
						<h2 className="font-display text-sm font-bold text-white">{t('legalHeading')}</h2>
						<ul className="mt-3 space-y-0">
							<li>
								<Link
									href="/privacy"
									className="-mx-2 inline-flex min-h-11 min-w-11 items-center px-2 text-white/70 transition-colors hover:text-white"
								>
									{t('privacy')}
								</Link>
							</li>
							<li>
								<Link
									href="/terms"
									className="-mx-2 inline-flex min-h-11 min-w-11 items-center px-2 text-white/70 transition-colors hover:text-white"
								>
									{t('terms')}
								</Link>
							</li>
							<li>
								<a
									href={`mailto:${SUPPORT_EMAIL}`}
									className="-mx-2 inline-flex min-h-11 min-w-11 items-center px-2 text-white/70 transition-colors hover:text-white"
								>
									{t('contact')}
								</a>
							</li>
						</ul>
					</nav>
				</div>

				<div className="mt-10 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs text-white/60 md:flex-row md:items-center md:justify-between">
					<p>{t('copyright', { year: currentYear })}</p>
					<p>{t('resetNote')}</p>
				</div>
			</div>
		</footer>
	)
}
