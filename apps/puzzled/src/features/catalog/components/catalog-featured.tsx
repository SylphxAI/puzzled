import { Clock, Play, Sparkles } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { type GameColorTheme, getGameColors } from '@/games/theme-colors'
import { Link } from '@/lib/i18n/routing'
import { cn } from '@/lib/utils'
import { GameIcon } from '@/shared/components/ui/game-icons'

type CatalogFeaturedProps = {
	slug: string
	name: string
	tagline: string
	duration: string
	highlight: string
	theme: GameColorTheme
}

/**
 * Today's free-rotation module, carried at catalog size.
 *
 * The rotation is the product's promise, so it leads the grid instead of being
 * one anonymous tile among nineteen: full colour theme, the free badge and the
 * play affordance in the module's own gradient.
 */
export async function CatalogFeatured({
	slug,
	name,
	tagline,
	duration,
	highlight,
	theme,
}: CatalogFeaturedProps) {
	const t = await getTranslations('catalog')
	const colors = getGameColors(theme)

	return (
		<section className="page-shell-wide pt-8">
			<div className="relative overflow-hidden rounded-3xl border border-border/70 bg-card p-5 shadow-card md:p-6">
				<div
					className={cn('pointer-events-none absolute inset-0 opacity-80', colors.pattern)}
					aria-hidden="true"
				/>

				<div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
					<div className="flex min-w-0 items-start gap-4">
						<span
							className={cn(
								'flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-md',
								colors.gradient,
							)}
						>
							<GameIcon slug={slug} size={28} />
						</span>
						<div className="min-w-0">
							<p className="chip bg-emerald-500/12 text-emerald-700 dark:text-emerald-400">
								<Sparkles className="h-3 w-3" aria-hidden="true" />
								{t('freeToday')}
							</p>
							<h2 className="mt-2 font-display text-2xl font-extrabold leading-tight">{name}</h2>
							<p className="mt-1 text-sm text-muted-foreground">{tagline}</p>
							<div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
								<span className="chip bg-background/80 text-muted-foreground">
									<Clock className="h-3 w-3" aria-hidden="true" />
									{duration}
								</span>
								<span className={cn('chip bg-background/80', colors.text)}>{highlight}</span>
							</div>
						</div>
					</div>

					<div className="flex flex-col gap-2 md:items-end">
						<Link
							href={`/games/${slug}`}
							className={cn(
								'inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-br px-6 font-semibold text-white shadow-md transition-transform hover:-translate-y-0.5 active:scale-[0.99]',
								colors.gradient,
							)}
						>
							<Play className="h-4 w-4" aria-hidden="true" />
							{t('featuredPlay', { game: name })}
						</Link>
						<p className="text-xs text-muted-foreground md:text-right">{t('featuredNote')}</p>
					</div>
				</div>
			</div>
		</section>
	)
}
