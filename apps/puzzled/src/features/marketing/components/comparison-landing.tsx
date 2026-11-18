import { ArrowRight, Check } from 'lucide-react'
import { getGameMetadata } from '@/games/registry'
import { getGameColors } from '@/games/theme-colors'
import { Link } from '@/lib/i18n/routing'
import { buildPageMetadata, ogImagePath } from '@/lib/seo/metadata'
import type { ComparisonSpec } from './comparison-specs'
import { MarketingCta } from './marketing-cta'
import { MarketingFaq } from './marketing-faq'
import { MarketingHero } from './marketing-hero'
import { MarketingSection } from './marketing-section'
import { INK_SECONDARY_CTA, SECONDARY_CTA } from './use-case-landing'
import { buildUseCaseJsonLd } from './use-case-specs'

/** The page's one amber action, as on the home page. */
const PLAY_CTA =
	'pressable inline-flex min-h-12 items-center gap-2 rounded-2xl bg-cta px-6 py-3 font-bold text-cta-foreground shadow-[inset_0_-3px_0_var(--color-cta-edge)] transition-colors hover:bg-cta-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'

export async function buildComparisonMetadata(locale: string, spec: ComparisonSpec) {
	return buildPageMetadata({
		locale,
		path: spec.path,
		title: spec.metaTitle,
		description: spec.metaDescription,
		type: 'article',
		imagePath: ogImagePath({
			title: spec.metaTitle,
			subtitle: spec.facts.join(' · '),
			eyebrow: spec.eyebrow,
		}),
	})
}

/**
 * An honest "Tryit vs X" page: a short verdict first, the side-by-side table,
 * credit where the other product is stronger, then closest-match games.
 */
export function ComparisonLanding({ spec }: { spec: ComparisonSpec }) {
	const structuredData = buildUseCaseJsonLd(spec)

	return (
		<main className="pb-16">
			<MarketingHero
				eyebrow={spec.eyebrow}
				title={spec.h1}
				lead={spec.lead}
				facts={spec.facts}
				actions={
					<>
						<Link href={spec.primaryCta.href} className={PLAY_CTA}>
							{spec.primaryCta.label}
							<ArrowRight className="h-4 w-4" aria-hidden="true" />
						</Link>
						<Link href={spec.secondaryCta.href} className={SECONDARY_CTA}>
							{spec.secondaryCta.label}
						</Link>
					</>
				}
				aside={
					<aside
						aria-labelledby="verdict-heading"
						className="surface-card border-l-4 border-l-cta p-6 md:p-7"
					>
						<h2 id="verdict-heading" className="font-display text-xl">
							{spec.verdictTitle}
						</h2>
						<ul className="mt-3 space-y-3 text-[15px] leading-relaxed text-muted-foreground">
							{spec.verdict.map((line) => (
								<li key={line}>{line}</li>
							))}
						</ul>
					</aside>
				}
			/>

			<MarketingSection
				id="side-by-side"
				title={spec.tableTitle}
				subtitle={spec.tableSubtitle}
				flush
			>
				<div className="surface-card overflow-hidden">
					<table className="block w-full border-collapse text-left text-sm md:table">
						<caption className="sr-only">{spec.tableTitle}</caption>
						<thead className="sr-only md:not-sr-only">
							<tr className="border-b border-border bg-muted/40">
								<th scope="col" className="w-1/5 px-5 py-3.5 font-display text-sm font-semibold">
									Feature
								</th>
								<th scope="col" className="w-2/5 px-5 py-3.5 font-display text-sm font-semibold">
									{spec.rival}
								</th>
								<th
									scope="col"
									className="w-2/5 bg-accent-warm-soft px-5 py-3.5 font-display text-sm font-semibold"
								>
									Tryit
								</th>
							</tr>
						</thead>
						<tbody className="block md:table-row-group">
							{spec.rows.map((row) => (
								<tr
									key={row.feature}
									className="block border-b border-border px-5 py-4 last:border-b-0 md:table-row md:p-0"
								>
									<th
										scope="row"
										className="block font-display text-base font-semibold text-foreground md:table-cell md:px-5 md:py-4 md:align-top md:text-sm"
									>
										{row.feature}
									</th>
									<td className="mt-2 block text-muted-foreground md:mt-0 md:table-cell md:px-5 md:py-4 md:align-top">
										<span className="eyebrow block md:hidden">{spec.rival}</span>
										{row.them}
									</td>
									<td className="mt-3 block rounded-xl bg-accent-warm-soft p-3 font-medium text-foreground md:mt-0 md:table-cell md:rounded-none md:px-5 md:py-4 md:align-top">
										<span className="eyebrow block md:hidden">Tryit</span>
										{row.us}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</MarketingSection>

			<MarketingSection id="strengths">
				<div className="grid gap-4 lg:grid-cols-2">
					<section aria-labelledby="their-strengths" className="surface-card p-6 md:p-7">
						<h2 id="their-strengths" className="font-display text-2xl text-balance">
							{spec.theirStrengthsTitle}
						</h2>
						<ul className="mt-4 space-y-4">
							{spec.theirStrengths.map((point) => (
								<li key={point.title}>
									<h3 className="font-display text-lg">{point.title}</h3>
									<p className="mt-1 text-sm leading-relaxed text-muted-foreground">{point.body}</p>
								</li>
							))}
						</ul>
					</section>
					<section
						aria-labelledby="our-strengths"
						className="surface-card border-2 border-foreground p-6 md:p-7"
					>
						<h2 id="our-strengths" className="font-display text-2xl text-balance">
							{spec.ourStrengthsTitle}
						</h2>
						<ul className="mt-4 space-y-4">
							{spec.ourStrengths.map((point) => (
								<li key={point.title} className="flex gap-3">
									<Check className="mt-1 h-5 w-5 shrink-0 text-success" aria-hidden="true" />
									<div>
										<h3 className="font-display text-lg">{point.title}</h3>
										<p className="mt-1 text-sm leading-relaxed text-muted-foreground">
											{point.body}
										</p>
									</div>
								</li>
							))}
						</ul>
					</section>
				</div>
			</MarketingSection>

			<MarketingSection id="pairings" title={spec.pairingsTitle} subtitle={spec.pairingsSubtitle}>
				<ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{spec.pairings.map((pairing) => {
						const game = getGameMetadata(pairing.slug)
						if (!game) return null
						const colors = getGameColors(game.display.theme)
						return (
							<li key={pairing.slug}>
								<Link
									href={`/games/${pairing.slug}`}
									className="surface-card group flex h-full overflow-hidden transition-shadow hover:shadow-lift focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
								>
									<span className={`w-2 shrink-0 ${colors.stripe}`} aria-hidden="true" />
									<span className="flex flex-col p-5">
										<span className="eyebrow">{`Like ${pairing.theirs}?`}</span>
										<span className="mt-1 flex items-center gap-1.5 font-display text-xl">
											{`Try ${game.name}`}
											<ArrowRight
												className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
												aria-hidden="true"
											/>
										</span>
										<span className="mt-1 text-sm leading-relaxed text-muted-foreground">
											{pairing.why}
										</span>
									</span>
								</Link>
							</li>
						)
					})}
				</ul>
			</MarketingSection>

			<MarketingFaq id="faq" title={spec.faqTitle} items={spec.faqs} emitStructuredData={false} />

			<MarketingCta title={spec.closingCta.title} body={spec.closingCta.body}>
				<Link href={spec.primaryCta.href} className={PLAY_CTA}>
					{spec.primaryCta.label}
					<ArrowRight className="h-4 w-4" aria-hidden="true" />
				</Link>
				<Link href={spec.secondaryCta.href} className={INK_SECONDARY_CTA}>
					{spec.secondaryCta.label}
				</Link>
			</MarketingCta>

			<div className="page-shell-wide">
				<p className="max-w-3xl text-xs leading-relaxed text-muted-foreground">{spec.disclaimer}</p>
			</div>

			<script
				type="application/ld+json"
				// biome-ignore lint/security/noDangerouslySetInnerHtml: trusted static JSON-LD graph for the comparison page
				dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
			/>
		</main>
	)
}
