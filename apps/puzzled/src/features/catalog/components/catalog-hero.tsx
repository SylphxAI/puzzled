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
	'pressable inline-flex h-11 shrink-0 items-center rounded-full px-4 text-sm font-semibold transition-colors'

const FILTER_CHIP_ACTIVE = 'bg-primary text-primary-foreground'
const FILTER_CHIP_IDLE = 'bg-muted text-foreground hover:bg-accent'

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
		<section className="relative">
			<div className="page-shell-wide pb-4 pt-8 md:pt-12">
				<p className="eyebrow">{t('heroEyebrow')}</p>
				<h1 className="mt-2 font-display text-[2.125rem] leading-[1.06] text-balance sm:text-5xl">
					{t('title')}
				</h1>
				<p className="mt-3 max-w-2xl text-[17px] leading-relaxed text-muted-foreground">
					{t('subtitle', { count: gameCount })}
				</p>

				<search className="mt-6 block">
					<form className="relative w-full max-w-xl">
						<label htmlFor="catalog-q" className="sr-only">
							{t('searchLabel')}
						</label>
						<Search
							className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
							aria-hidden="true"
						/>
						<input
							id="catalog-q"
							type="search"
							name="q"
							defaultValue={query}
							placeholder={t('searchPlaceholder')}
							enterKeyHint="search"
							className="h-11 w-full rounded-xl border border-transparent bg-muted pl-10 pr-24 text-[16px] outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:bg-card"
						/>
						{category !== 'all' && <input type="hidden" name="category" value={category} />}
						<button
							type="submit"
							className="absolute right-1 top-1 inline-flex h-9 items-center rounded-lg px-3 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
						>
							{t('searchSubmit')}
						</button>
					</form>
				</search>

				<fieldset className="no-scrollbar -mx-4 mt-3 flex items-center gap-2 overflow-x-auto border-0 px-4 py-1 md:mx-0 md:px-0">
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

				<div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
					<output>{t('showing', { count: visibleCount, total: gameCount })}</output>
					{filtersActive && (
						<Link
							href="/games"
							className="font-semibold text-foreground underline underline-offset-4"
						>
							{t('clearFilter')}
						</Link>
					)}
				</div>
			</div>
		</section>
	)
}
