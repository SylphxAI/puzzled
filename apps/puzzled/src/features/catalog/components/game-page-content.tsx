import { ArrowRight, ChevronDown, Lightbulb } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { readMessage } from '@/features/catalog/lib/catalog'
import type { GameFaqItem } from '@/features/catalog/lib/game-page'
import { getGameMetadata } from '@/games/registry'
import { playerTitle, slugToCamelCase } from '@/lib/game-slug'
import { Link } from '@/lib/i18n/routing'
import { GameTile } from '@/shared/components/games/game-tile'

type GamePageContentProps = {
	/** Player-facing module name, already resolved for this locale. */
	name: string
	/** Rule statements from the module's own `rules` copy. */
	rules: readonly string[]
	/** Strategy tips written for this module. */
	tips: readonly string[]
	/** Module FAQ; the section renders only when copy exists. */
	faq: readonly GameFaqItem[]
	/** Related module slugs (same category first). */
	relatedSlugs: readonly string[]
	/** Today's free-rotation module. */
	freeGameSlug: string
}

/**
 * The readable half of a game page: rules, strategy, FAQ and related modules.
 *
 * Everything here is server-rendered for every viewer, so a module page stays
 * a real landing page even when the interactive client is gated or offline.
 * The FAQ copy is rendered and emitted as FAQPage structured data from one
 * array, so the visible answer and the machine-readable answer cannot drift.
 */
export async function GamePageContent({
	name,
	rules,
	tips,
	faq,
	relatedSlugs,
	freeGameSlug,
}: GamePageContentProps) {
	const t = await getTranslations('catalog')
	const tGames = await getTranslations('games')

	const faqStructuredData = {
		'@context': 'https://schema.org',
		'@type': 'FAQPage',
		mainEntity: faq.map((item) => ({
			'@type': 'Question',
			name: item.question,
			acceptedAnswer: { '@type': 'Answer', text: item.answer },
		})),
	}

	const related = relatedSlugs.flatMap((relatedSlug) => {
		const metadata = getGameMetadata(relatedSlug)
		if (!metadata) return []
		const camel = slugToCamelCase(metadata.slug)
		return [
			{
				slug: metadata.slug,
				name: readMessage(tGames, `${camel}.name`, playerTitle(metadata.slug)),
				tagline: readMessage(tGames, `${camel}.tagline`, ''),
				meta: [metadata.display.duration, readMessage(tGames, `${camel}.highlight`, '')]
					.filter(Boolean)
					.join(' • '),
				theme: metadata.display.theme,
				status: metadata.slug === freeGameSlug ? ('free' as const) : ('play' as const),
			},
		]
	})

	return (
		<>
			{rules.length > 0 && (
				<section className="section-block">
					<div className="page-shell">
						<h2 className="font-display text-2xl font-extrabold tracking-tight">
							{t('gamePage.howToPlayTitle', { game: name })}
						</h2>
						<ol className="mt-5 space-y-2.5">
							{rules.map((rule, index) => (
								<li key={rule} className="flex gap-3.5 text-sm leading-relaxed">
									<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary tnum">
										{index + 1}
									</span>
									<span className="pt-0.5">{rule}</span>
								</li>
							))}
						</ol>
					</div>
				</section>
			)}

			{tips.length > 0 && (
				<section className="section-block pt-0">
					<div className="page-shell">
						<h2 className="font-display text-2xl font-extrabold tracking-tight">
							{t('gamePage.tipsTitle', { game: name })}
						</h2>
						<ul className="mt-5 space-y-3">
							{tips.map((tip) => (
								<li
									key={tip}
									className="flex gap-3.5 rounded-2xl border border-border/70 bg-card p-4 text-sm leading-relaxed"
								>
									<Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
									<span>{tip}</span>
								</li>
							))}
						</ul>
					</div>
				</section>
			)}

			{faq.length > 0 && (
				<section className="section-block pt-0">
					<div className="page-shell">
						<h2 className="font-display text-2xl font-extrabold tracking-tight">
							{t('gamePage.faqTitle', { game: name })}
						</h2>
						<div className="mt-5 space-y-3">
							{faq.map((item) => (
								<details
									key={item.question}
									className="group rounded-2xl border border-border/70 bg-card px-5 py-4 open:shadow-card"
								>
									<summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-1 font-display text-base font-bold marker:content-none">
										{item.question}
										<ChevronDown
											className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
											aria-hidden="true"
										/>
									</summary>
									<p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
										{item.answer}
									</p>
								</details>
							))}
						</div>
					</div>

					<script
						type="application/ld+json"
						// biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD with trusted catalog content
						dangerouslySetInnerHTML={{ __html: JSON.stringify(faqStructuredData) }}
					/>
				</section>
			)}

			{related.length > 0 && (
				<section className="section-block pt-0">
					<div className="page-shell">
						<div className="flex flex-wrap items-end justify-between gap-3">
							<h2 className="font-display text-2xl font-extrabold tracking-tight">
								{t('gamePage.relatedTitle')}
							</h2>
							<Link
								href="/games"
								className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/10"
							>
								{t('gamePage.relatedAll')}
								<ArrowRight className="h-4 w-4" aria-hidden="true" />
							</Link>
						</div>

						<ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
							{related.map((module, index) => (
								<li key={module.slug} className="h-full">
									<GameTile
										slug={module.slug}
										name={module.name}
										tagline={module.tagline}
										meta={module.meta}
										theme={module.theme}
										status={module.status}
										index={index}
										labels={{
											play: t('open'),
											playAgain: t('open'),
											freeToday: t('freeToday'),
										}}
									/>
								</li>
							))}
						</ul>
					</div>
				</section>
			)}
		</>
	)
}
