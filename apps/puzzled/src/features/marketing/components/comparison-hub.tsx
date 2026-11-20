import { ArrowRight } from 'lucide-react'
import { getGameMetadata } from '@/games/registry'
import { getGameColors } from '@/games/theme-colors'
import { Link } from '@/lib/i18n/routing'
import { buildPageMetadata, ogImagePath } from '@/lib/seo/metadata'
import { GameMotifImage } from '@/shared/components/games/game-motif'
import { PLAY_CTA } from './comparison-landing'
import { COMPARISON_HUB, COMPARISONS, type ComparisonSpec } from './comparison-specs'
import { MarketingCta } from './marketing-cta'
import { MarketingHero } from './marketing-hero'
import { MarketingSection } from './marketing-section'
import { INK_SECONDARY_CTA, SECONDARY_CTA } from './use-case-landing'

const ORIGIN = 'https://tryit.fun'

export async function buildComparisonHubMetadata(locale: string) {
	return buildPageMetadata({
		locale,
		path: COMPARISON_HUB.path,
		title: COMPARISON_HUB.metaTitle,
		description: COMPARISON_HUB.metaDescription,
		englishOnly: true,
		imagePath: ogImagePath({
			title: COMPARISON_HUB.metaTitle,
			subtitle: COMPARISON_HUB.facts.join(' · '),
			eyebrow: COMPARISON_HUB.eyebrow,
		}),
	})
}

/** The hub as a schema.org collection of the comparison pages it lists. */
export function buildComparisonHubJsonLd() {
	return {
		'@context': 'https://schema.org',
		'@type': 'CollectionPage',
		name: COMPARISON_HUB.metaTitle,
		description: COMPARISON_HUB.metaDescription,
		url: `${ORIGIN}${COMPARISON_HUB.path}`,
		mainEntity: {
			'@type': 'ItemList',
			itemListElement: COMPARISONS.map((spec, index) => ({
				'@type': 'ListItem',
				position: index + 1,
				name: `Tryit vs ${spec.rival}`,
				url: `${ORIGIN}${spec.path}`,
			})),
		},
	}
}

/**
 * One comparison as a printed card: the field shows the board of the Tryit
 * game nearest to the rival's best-known one, then the two-line verdict. The
 * whole card is the link.
 */
function ComparisonCard({ spec, cta }: { spec: ComparisonSpec; cta: string }) {
	const [pairing] = spec.pairings
	const game = pairing ? getGameMetadata(pairing.slug) : null
	const colors = game ? getGameColors(game.display.theme) : null
	const [theirs, ours] = spec.verdict

	return (
		<Link
			href={spec.path}
			data-comparison-card={spec.slug}
			className="tactile-card group flex h-full flex-col overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
		>
			<div
				className={`tactile-card-field relative aspect-[16/7] overflow-hidden px-3 py-2 ${colors?.bg ?? 'bg-muted'}`}
			>
				{pairing && game && (
					<>
						<GameMotifImage
							slug={pairing.slug}
							className="transition-transform duration-medium ease-out group-hover:scale-[1.04]"
						/>
						<span className="absolute bottom-2 left-2 max-w-[calc(100%-1rem)] truncate rounded-full border border-[#1a1712] bg-[#fbf9f4] px-2 py-0.5 text-[11px] font-semibold leading-4 text-[#1a1712]">
							{`Like ${pairing.theirs}? Try ${game.name}`}
						</span>
					</>
				)}
			</div>
			<div className="flex flex-1 flex-col p-4 sm:p-5">
				<h3 className="font-display text-xl leading-tight">{`Tryit vs ${spec.rival}`}</h3>
				<p className="mt-2 text-sm leading-relaxed text-muted-foreground">{theirs}</p>
				<p className="mt-2 flex-1 text-sm font-medium leading-relaxed text-foreground">
					<span
						className="mr-1.5 inline-block h-2.5 w-2.5 rounded-[3px] border border-foreground bg-cta align-baseline"
						aria-hidden="true"
					/>
					{ours}
				</p>
				<span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-foreground underline-offset-4 group-hover:underline">
					{cta}
					<ArrowRight
						className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
						aria-hidden="true"
					/>
				</span>
			</div>
		</Link>
	)
}

/**
 * `/vs`: every comparison on one broadsheet page. The masthead rule and the
 * printed cards are the home page's; the copy is each comparison's own short
 * answer, so the hub never states a fact its page does not.
 */
export function ComparisonHub() {
	const hub = COMPARISON_HUB

	return (
		<main className="pb-16">
			<MarketingHero
				eyebrow={hub.eyebrow}
				title={hub.h1}
				lead={hub.lead}
				facts={hub.facts}
				actions={
					<>
						<Link href={hub.primaryCta.href} className={PLAY_CTA}>
							{hub.primaryCta.label}
							<ArrowRight className="h-4 w-4" aria-hidden="true" />
						</Link>
						<Link href={hub.secondaryCta.href} className={SECONDARY_CTA}>
							{hub.secondaryCta.label}
						</Link>
					</>
				}
			/>

			<section aria-labelledby="comparisons-heading" className="page-shell-wide">
				<ul className="masthead-rule flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-xs text-muted-foreground sm:text-[13px]">
					{hub.masthead.map((label, index) => (
						<li key={label} className="flex items-center gap-3">
							{index > 0 && (
								<span aria-hidden="true" className="text-foreground/40">
									·
								</span>
							)}
							<span className={index === 0 ? 'font-semibold text-foreground' : undefined}>
								{label}
							</span>
						</li>
					))}
				</ul>
				<div className="mt-6">
					<h2 id="comparisons-heading" className="font-display text-2xl text-balance md:text-3xl">
						{hub.listTitle}
					</h2>
					<p className="mt-2 max-w-2xl leading-relaxed text-muted-foreground">{hub.listSubtitle}</p>
				</div>
				<ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{COMPARISONS.map((spec) => (
						<li key={spec.slug}>
							<ComparisonCard spec={spec} cta={hub.cardCta} />
						</li>
					))}
				</ul>
			</section>

			<MarketingSection id="how-we-compare" title={hub.principlesTitle}>
				<ul className="grid gap-6 border-t border-foreground pt-6 md:grid-cols-3">
					{hub.principles.map((point) => (
						<li key={point.title}>
							<h3 className="font-display text-lg">{point.title}</h3>
							<p className="mt-1 text-sm leading-relaxed text-muted-foreground">{point.body}</p>
						</li>
					))}
				</ul>
			</MarketingSection>

			<MarketingCta title={hub.closingCta.title} body={hub.closingCta.body}>
				<Link href={hub.primaryCta.href} className={PLAY_CTA}>
					{hub.primaryCta.label}
					<ArrowRight className="h-4 w-4" aria-hidden="true" />
				</Link>
				<Link href={hub.secondaryCta.href} className={INK_SECONDARY_CTA}>
					{hub.secondaryCta.label}
				</Link>
			</MarketingCta>

			<script
				type="application/ld+json"
				// biome-ignore lint/security/noDangerouslySetInnerHtml: trusted static JSON-LD for the comparison hub
				dangerouslySetInnerHTML={{ __html: JSON.stringify(buildComparisonHubJsonLd()) }}
			/>
		</main>
	)
}
