import { ChevronDown } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { cn } from '@/lib/utils'

export type MarketingFaqItem = {
	question: string
	answer: string
}

/**
 * What a page hands the FAQ when it composes the item array in the page.
 *
 * The two branches are deliberately exclusive: a page either supplies finished
 * `items`, or it supplies a `namespace` plus the `keys` to read from it. A
 * `namespace` on its own is ambiguous — `useTranslations('home')` would also
 * resolve `title` — so a page that wants the namespace form must list keys.
 */
type MarketingFaqItemsProps = {
	/** Anchor id shared by the section and its heading. */
	id: string
	items: readonly MarketingFaqItem[]
	itemsFrom?: never
	keys?: never
	namespace?: never
}

type MarketingFaqNamespaceProps = {
	id: string
	items?: never
	/** Selects the namespace form, e.g. `namespace` + `keys`. */
	itemsFrom: 'namespace'
	/** Message namespace holding the items, e.g. `home`. */
	namespace: string
	/** Dotted item keys inside the namespace, each with `.question`/`.answer`. */
	keys: readonly string[]
}

type MarketingFaqCommonProps = {
	/** Section heading; omit when the FAQ sits under an existing heading. */
	title?: string
	subtitle?: string
	/** Two columns on desktop for short answers; one column for long prose. */
	columns?: 1 | 2
	className?: string
}

type MarketingFaqProps = (MarketingFaqItemsProps | MarketingFaqNamespaceProps) &
	MarketingFaqCommonProps

/**
 * Accessible FAQ list.
 *
 * Native `<details>`/`<summary>` keeps answers in the served HTML (crawlers
 * and no-JS readers see them), gives keyboard operation for free, and the same
 * copy feeds the FAQPage structured data so the two can never drift. The
 * chevron is decorative: the open state is conveyed by the native disclosure,
 * never by colour alone. The 44px summary target and the focus ring are part
 * of the component so no caller can drop them.
 *
 * Every FAQ on the site renders through this component: it is the one home for
 * the disclosure behaviour and the structured data, so a page cannot ship an
 * FAQ with a different target size or a missing JSON-LD block.
 */
export async function MarketingFaq({
	id,
	title,
	subtitle,
	items,
	namespace,
	keys,
	columns = 2,
	className,
}: MarketingFaqProps) {
	const headingId = `${id}-heading`
	const resolvedItems: readonly MarketingFaqItem[] = items
		? items
		: await resolveNamespaceItems(namespace as string, keys as readonly string[])
	const structuredData = {
		'@context': 'https://schema.org',
		'@type': 'FAQPage',
		mainEntity: resolvedItems.map((item) => ({
			'@type': 'Question',
			name: item.question,
			acceptedAnswer: { '@type': 'Answer', text: item.answer },
		})),
	}

	return (
		<section
			id={id}
			aria-labelledby={title ? headingId : undefined}
			// scroll-mt keeps an in-page anchor clear of the sticky h-16 shell header.
			className={cn('section-block scroll-mt-24', className)}
		>
			<div className="page-shell-wide">
				{title && (
					<h2
						id={headingId}
						className="font-display text-2xl font-extrabold tracking-tight text-balance md:text-3xl"
					>
						{title}
					</h2>
				)}
				{subtitle && (
					<p className="mt-2 max-w-2xl leading-relaxed text-muted-foreground">{subtitle}</p>
				)}
				<div
					className={cn(
						'grid gap-3',
						(title || subtitle) && 'mt-6',
						columns === 2 && 'md:grid-cols-2',
					)}
				>
					{resolvedItems.map((item) => (
						<details
							key={item.question}
							className="group rounded-2xl border border-border/70 bg-card px-4 py-1 open:shadow-card"
						>
							<summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 py-3 font-display text-base font-bold marker:content-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
								{item.question}
								<ChevronDown
									className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
									aria-hidden="true"
								/>
							</summary>
							<p className="pb-4 pr-6 text-sm leading-relaxed text-muted-foreground">
								{item.answer}
							</p>
						</details>
					))}
				</div>
			</div>

			<script
				type="application/ld+json"
				// biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD built from trusted translation content
				dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
			/>
		</section>
	)
}

/** Reads `keys` out of one message namespace in the current request locale. */
async function resolveNamespaceItems(
	namespace: string,
	keys: readonly string[],
): Promise<readonly MarketingFaqItem[]> {
	const t = await getTranslations(namespace)
	return keys.map((key) => ({
		question: t(`${key}.question`),
		answer: t(`${key}.answer`),
	}))
}
