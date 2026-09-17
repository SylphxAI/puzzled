import { ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { MarketingSection } from './marketing-section'

/** One section of a published legal document, in the document's own order. */
export type LegalSection = {
	/** Stable anchor id; the table of contents targets it. */
	id: string
	/** Heading copy, verbatim from the published document. */
	title: string
	/** Body copy, one entry per paragraph. */
	paragraphs: readonly ReactNode[]
	/** Bullet list, preserved verbatim from the published document. */
	bullets?: readonly ReactNode[]
	/** Address of the contact section, rendered as a `mailto:` link. */
	contactEmail?: string
}

type LegalDocumentProps = {
	/** Locale used to present the revision date. */
	locale: string
	/** ISO revision date from legal.json; without one no date is rendered. */
	revision?: string
	/** Localized "last updated" label from legal.json. */
	lastUpdatedLabel: string
	/** Localized table-of-contents heading; it also names the nav landmark. */
	tocTitle: string
	sections: readonly LegalSection[]
}

/**
 * Date-only ISO input: the instant is pinned to UTC so the calendar day can
 * never shift for a reader in another time zone. Unusable input yields no date
 * rather than a placeholder string.
 */
function formatRevision(revision: string, locale: string): string | null {
	const date = new Date(`${revision}T00:00:00Z`)
	if (Number.isNaN(date.getTime())) return null

	return new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(date)
}

/**
 * Shared layout for the published legal documents: a table of contents beside
 * the prose.
 *
 * The prose is served as static HTML with one heading per section, so anchors,
 * screen-reader navigation and text selection work without JavaScript. The
 * contents list is sticky beside the prose on desktop and collapses into a
 * native `<details>` on mobile, where it would otherwise push the first
 * section off the screen.
 */
export function LegalDocument({
	locale,
	revision,
	lastUpdatedLabel,
	tocTitle,
	sections,
}: LegalDocumentProps) {
	const tocHeadingId = 'legal-toc-heading'
	const revised = revision ? formatRevision(revision, locale) : null
	const tocItems = sections.map((section) => (
		<li key={section.id}>
			<a
				href={`#${section.id}`}
				className="flex min-h-11 items-center rounded-lg px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
			>
				{section.title}
			</a>
		</li>
	))

	return (
		<MarketingSection id="document" flush>
			<div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-12">
				<nav aria-labelledby={tocHeadingId} className="lg:sticky lg:top-24 lg:self-start">
					<p
						id={tocHeadingId}
						className="hidden text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:block"
					>
						{tocTitle}
					</p>

					{/* Mobile: the native disclosure keeps the list keyboard operable. */}
					<details className="group surface-card lg:hidden">
						<summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-display text-sm font-bold marker:content-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
							{tocTitle}
							<ChevronDown
								className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
								aria-hidden="true"
							/>
						</summary>
						<ul className="border-t border-border/70 p-2">{tocItems}</ul>
					</details>

					<ul className="mt-3 hidden lg:grid lg:gap-0.5">{tocItems}</ul>
				</nav>

				<div className="min-w-0 max-w-[70ch] animate-enter">
					{revised && (
						<p className="text-sm text-muted-foreground">
							{lastUpdatedLabel}: <time dateTime={revision}>{revised}</time>
						</p>
					)}

					<div className={cn('grid gap-8 md:gap-10', revised && 'mt-6')}>
						{sections.map((section) => (
							<section
								key={section.id}
								id={section.id}
								aria-labelledby={`${section.id}-heading`}
								className="scroll-mt-24"
							>
								<h2
									id={`${section.id}-heading`}
									className="font-display text-xl font-extrabold tracking-tight text-balance md:text-2xl"
								>
									{section.title}
								</h2>
								<div className="mt-3 grid gap-3">
									{section.paragraphs.map((paragraph, index) => (
										<p key={index} className="text-base leading-relaxed text-muted-foreground">
											{paragraph}
										</p>
									))}
									{section.bullets && (
										<ul className="grid list-disc gap-2 pl-6 marker:text-muted-foreground">
											{section.bullets.map((bullet, index) => (
												<li key={index} className="text-base leading-relaxed text-muted-foreground">
													{bullet}
												</li>
											))}
										</ul>
									)}
									{section.contactEmail && (
										<p>
											{/*
											 * `text-primary` carries both themes: indigo-600 in light,
											 * light indigo in dark, each ≥4.5:1 on its surface.
											 */}
											<a
												href={`mailto:${section.contactEmail}`}
												className="inline-flex min-h-11 items-center font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
											>
												{section.contactEmail}
											</a>
										</p>
									)}
								</div>
							</section>
						))}
					</div>
				</div>
			</div>
		</MarketingSection>
	)
}
