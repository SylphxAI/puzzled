import { ArrowRight } from 'lucide-react'
import { Link } from '@/lib/i18n/routing'
import { buildPageMetadata, ogImagePath } from '@/lib/seo/metadata'
import { MarketingCta } from './marketing-cta'
import { MarketingFaq } from './marketing-faq'
import { MarketingHero } from './marketing-hero'
import { MarketingSection } from './marketing-section'
import { buildUseCaseJsonLd, type UseCaseSpec } from './use-case-specs'

const PRIMARY_CTA =
	'inline-flex min-h-12 items-center gap-2 rounded-2xl bg-primary px-6 py-3 font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-transform hover:-translate-y-0.5 hover:bg-primary-hover active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'

const SECONDARY_CTA =
	'inline-flex min-h-12 items-center gap-2 rounded-2xl border border-border bg-background/80 px-5 py-3 font-semibold backdrop-blur transition-colors hover:border-primary/30 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'

const INK_SECONDARY_CTA =
	'inline-flex min-h-12 items-center gap-2 rounded-2xl border border-white/25 bg-white/10 px-5 py-3 font-semibold text-white transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'

export async function buildUseCaseMetadata(locale: string, spec: UseCaseSpec) {
	return buildPageMetadata({
		locale,
		path: spec.path,
		title: spec.metaTitle,
		description: spec.metaDescription,
		imagePath: ogImagePath({
			title: spec.metaTitle,
			subtitle: spec.metaDescription,
			eyebrow: spec.eyebrow,
		}),
	})
}

export function UseCaseLanding({ spec }: { spec: UseCaseSpec }) {
	const structuredData = buildUseCaseJsonLd(spec)

	return (
		<main className="pb-16">
			<MarketingHero
				eyebrow={spec.eyebrow}
				title={spec.h1}
				lead={spec.heroSubhead}
				facts={spec.facts}
				actions={
					<>
						<Link href={spec.primaryCta.href} className={PRIMARY_CTA}>
							{spec.primaryCta.label}
							<ArrowRight className="h-4 w-4" aria-hidden="true" />
						</Link>
						<Link href={spec.secondaryCta.href} className={SECONDARY_CTA}>
							{spec.secondaryCta.label}
						</Link>
					</>
				}
			/>

			<MarketingSection
				id="how-it-works"
				title={spec.workflowTitle}
				subtitle={spec.workflowSubtitle}
				flush
			>
				<ol className="grid gap-4 lg:grid-cols-3">
					{spec.workflows.map((step, index) => (
						<li key={step.title} className="surface-card flex flex-col p-6">
							<span className="eyebrow">Step {index + 1}</span>
							<h3 className="mt-2 font-display text-lg text-balance">{step.title}</h3>
							<p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
							{step.groups && (
								<ul className="mt-3 space-y-1.5 text-sm leading-relaxed text-muted-foreground">
									{step.groups.map((group) => (
										<li key={group.heading}>
											<strong className="font-semibold text-foreground">{group.heading}:</strong>{' '}
											{group.games}
										</li>
									))}
								</ul>
							)}
						</li>
					))}
				</ol>
			</MarketingSection>

			<MarketingSection
				id="comparison"
				title={spec.comparisonTitle}
				subtitle={spec.comparisonSubtitle}
			>
				<div className="surface-card overflow-x-auto">
					<table className="w-full min-w-[640px] border-collapse text-left text-sm">
						<caption className="sr-only">{spec.comparisonTitle}</caption>
						<thead>
							<tr className="border-b border-border bg-muted/40">
								{spec.comparisonHeaders.map((header) => (
									<th
										key={header}
										scope="col"
										className="px-4 py-3.5 font-display text-sm font-semibold"
									>
										{header}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{spec.comparisonRows.map((row) => (
								<tr key={row.feature} className="border-b border-border last:border-b-0">
									<th scope="row" className="px-4 py-3.5 font-semibold text-foreground align-top">
										{row.feature}
									</th>
									<td className="px-4 py-3.5 text-muted-foreground align-top">{row.columns[0]}</td>
									<td className="px-4 py-3.5 text-muted-foreground align-top">{row.columns[1]}</td>
									<td className="px-4 py-3.5 font-medium text-foreground align-top">
										{row.columns[2]}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</MarketingSection>

			<MarketingFaq id="faq" title={spec.faqTitle} items={spec.faqs} emitStructuredData={false} />

			<MarketingCta
				title={spec.closingCta.title}
				body={spec.closingCta.body}
				note={spec.closingCta.note}
			>
				<Link href={spec.primaryCta.href} className={PRIMARY_CTA}>
					{spec.primaryCta.label}
					<ArrowRight className="h-4 w-4" aria-hidden="true" />
				</Link>
				<Link href={spec.secondaryCta.href} className={INK_SECONDARY_CTA}>
					{spec.secondaryCta.label}
				</Link>
			</MarketingCta>

			<script
				type="application/ld+json"
				// biome-ignore lint/security/noDangerouslySetInnerHtml: trusted static JSON-LD graph for use-case landing page
				dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
			/>
		</main>
	)
}
