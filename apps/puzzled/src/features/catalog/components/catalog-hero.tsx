import { Search } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { CATALOG_CATEGORIES, type CatalogCategoryFilter } from '@/features/catalog/lib/catalog'
import { Link } from '@/lib/i18n/routing'
import { cn } from '@/lib/utils'

type CatalogHeroProps = {
	/** Registered modules in the suite; the promise never hardcodes the count. */
	gameCount: number
	/** Modules left after the active filters. */
	visibleCount: number
	/** Active title filter (`?q=`). */
	query: string
	/** Active category filter (`?category=`). */
	category: CatalogCategoryFilter
}

const FILTER_CHIP =
	'inline-flex h-11 items-center rounded-full border px-4 text-sm font-semibold transition-colors'

const FILTER_CHIP_ACTIVE = 'border-primary bg-primary/10 text-primary'
const FILTER_CHIP_IDLE =
	'border-border bg-background/70 text-muted-foreground hover:border-primary/30 hover:text-primary'

/**
 * Catalog hero: the suite promise, the title filter and the category filter.
 *
 * Both filters are plain GET navigation, so they work without JavaScript and
 * the URL always describes what is on screen. The result count lives in an
 * `<output>`, which assistive technology announces when the filters change it.
 */
export async function CatalogHero({ gameCount, visibleCount, query, category }: CatalogHeroProps) {
	const t = await getTranslations('catalog')
	const filtersActive = Boolean(query) || category !== 'all'

	const hrefFor = (nextCategory: CatalogCategoryFilter) => {
		const params = new URLSearchParams()
		if (query) params.set('q', query)
		if (nextCategory !== 'all') params.set('category', nextCategory)
		const search = params.toString()
		return search ? `/games?${search}` : '/games'
	}

	const filterOptions: { value: CatalogCategoryFilter; label: string }[] = [
		{ value: 'all', label: t('filterAll') },
		...CATALOG_CATEGORIES.map((value) => ({ value, label: t(`category.${value}`) })),
	]

	return (
		<section className="relative overflow-hidden border-b border-border/60 bg-aurora">
			<div className="page-shell-wide pb-8 pt-8 md:pb-10 md:pt-12">
				<p className="chip bg-background/70 text-muted-foreground">{t('heroEyebrow')}</p>
				<h1 className="mt-4 font-display text-3xl font-extrabold tracking-tight text-balance md:text-4xl">
					{t('title')}
				</h1>
				<p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
					{t('subtitle', { count: gameCount })}
				</p>

				<search className="mt-6 block">
					<form className="flex w-full max-w-xl items-stretch gap-2">
						<label htmlFor="catalog-q" className="sr-only">
							{t('searchLabel')}
						</label>
						<input
							id="catalog-q"
							type="search"
							name="q"
							defaultValue={query}
							placeholder={t('searchPlaceholder')}
							className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-background/90 px-3.5 text-sm outline-none transition-colors focus:border-primary"
						/>
						{category !== 'all' && <input type="hidden" name="category" value={category} />}
						<button
							type="submit"
							className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border border-border bg-background/90 px-4 text-sm font-semibold transition-colors hover:border-primary/30 hover:text-primary"
						>
							<Search className="h-4 w-4" aria-hidden="true" />
							{t('searchSubmit')}
						</button>
					</form>
				</search>

				<fieldset className="mt-4 flex flex-wrap items-center gap-2 border-0 p-0">
					<legend className="sr-only">{t('filterLabel')}</legend>
					{filterOptions.map((option) => (
						<Link
							key={option.value}
							href={hrefFor(option.value)}
							aria-current={category === option.value ? 'page' : undefined}
							className={cn(
								FILTER_CHIP,
								category === option.value ? FILTER_CHIP_ACTIVE : FILTER_CHIP_IDLE,
							)}
						>
							{option.label}
						</Link>
					))}
				</fieldset>

				<div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
					<output>{t('showing', { count: visibleCount, total: gameCount })}</output>
					{filtersActive && (
						<Link href="/games" className="font-semibold text-primary hover:underline">
							{t('clearFilter')}
						</Link>
					)}
				</div>
			</div>
		</section>
	)
}
