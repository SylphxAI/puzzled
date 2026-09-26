import { getTranslations } from 'next-intl/server'
import { getAllGameMetadata } from '@/games/registry'
import { SUPPORT_EMAIL } from '@/lib/config/app'
import { slugToCamelCase } from '@/lib/game-slug'
import { Link } from '@/lib/i18n/routing'
import { LanguageSwitcher } from './language-switcher'
import { Logo } from './logo'

const FOOTER_GAME_LIMIT = 8

const linkClass =
	'-mx-2 inline-flex min-h-11 min-w-11 items-center px-2 text-muted-foreground transition-colors hover:text-foreground'

/**
 * Site footer: a quiet paper band under a hairline. Server rendered, because it
 * carries the internal link graph (every game, the catalogue, support, legal)
 * and the language entry point on every crawled page.
 */
export async function Footer() {
	const t = await getTranslations('footer')
	const tNav = await getTranslations('nav')
	const tGame = await getTranslations()
	const games = getAllGameMetadata().slice(0, FOOTER_GAME_LIMIT)
	const currentYear = new Date().getFullYear()

	return (
		<footer className="mt-auto border-t border-border bg-background">
			<div className="page-shell-wide py-10 md:py-14">
				<div className="grid gap-8 sm:grid-cols-2 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
					<div className="sm:col-span-2 md:col-span-1">
						<Logo size="sm" />
						<p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
							{t('tagline')}
						</p>
						<div className="mt-4">
							<LanguageSwitcher variant="button" />
						</div>
					</div>

					<nav aria-label={t('playHeading')} className="text-sm">
						<h2 className="eyebrow">{t('playHeading')}</h2>
						<ul className="mt-2">
							{games.map((game) => (
								<li key={game.slug}>
									<Link href={`/games/${game.slug}`} className={linkClass}>
										{tGame(`games.${slugToCamelCase(game.slug)}.name`)}
									</Link>
								</li>
							))}
							<li>
								<Link href="/games" className={`${linkClass} font-semibold text-foreground`}>
									{t('allGames')} →
								</Link>
							</li>
						</ul>
					</nav>

					<nav aria-label={t('productHeading')} className="text-sm">
						<h2 className="eyebrow">{t('productHeading')}</h2>
						<ul className="mt-2">
							<li>
								<Link href="/pricing" className={linkClass}>
									{tNav('plus')}
								</Link>
							</li>
							<li>
								<Link href="/archive" className={linkClass}>
									{tNav('archive')}
								</Link>
							</li>
							<li>
								<Link href="/stats" className={linkClass}>
									{tNav('stats')}
								</Link>
							</li>
							<li>
								<Link href="/leaderboard" className={linkClass}>
									{tNav('leaderboard')}
								</Link>
							</li>
							<li>
								<Link href="/support" className={linkClass}>
									{tNav('support')}
								</Link>
							</li>
						</ul>
					</nav>

					<nav aria-label={t('legalHeading')} className="text-sm">
						<h2 className="eyebrow">{t('legalHeading')}</h2>
						<ul className="mt-2">
							<li>
								<Link href="/privacy" className={linkClass}>
									{t('privacy')}
								</Link>
							</li>
							<li>
								<Link href="/terms" className={linkClass}>
									{t('terms')}
								</Link>
							</li>
							<li>
								<a href={`mailto:${SUPPORT_EMAIL}`} className={linkClass}>
									{t('contact')}
								</a>
							</li>
						</ul>
					</nav>
				</div>

				<div className="mt-10 flex flex-col gap-2 border-t border-border pt-6 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
					<p>{t('copyright', { year: currentYear })}</p>
					<p>{t('resetNote')}</p>
				</div>
			</div>
		</footer>
	)
}
