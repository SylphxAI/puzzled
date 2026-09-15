import { ChevronDown } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

const FAQ_KEYS = ['free', 'account', 'schedule', 'streak', 'share', 'catalog'] as const

/**
 * Home FAQ.
 *
 * Native <details> keeps the answers in the served HTML for crawlers and
 * works without JavaScript, and the same copy feeds the FAQPage structured
 * data so the two can never drift.
 */
export async function HomeFaq() {
	const t = await getTranslations('home')
	const faqs = FAQ_KEYS.map((key) => ({
		question: t(`faq.${key}.question`),
		answer: t(`faq.${key}.answer`),
	}))

	const structuredData = {
		'@context': 'https://schema.org',
		'@type': 'FAQPage',
		mainEntity: faqs.map((faq) => ({
			'@type': 'Question',
			name: faq.question,
			acceptedAnswer: { '@type': 'Answer', text: faq.answer },
		})),
	}

	return (
		<section className="section-block pt-0">
			<div className="page-shell-wide">
				<h2 className="font-display text-2xl font-extrabold tracking-tight md:text-3xl">
					{t('faq.title')}
				</h2>
				<p className="mt-2 max-w-2xl text-muted-foreground">{t('faq.subtitle')}</p>

				<div className="mt-6 grid gap-3 md:grid-cols-2">
					{faqs.map((faq) => (
						<details
							key={faq.question}
							className="group rounded-2xl border border-border/70 bg-card px-5 py-4 open:shadow-card"
						>
							<summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-display text-base font-bold marker:content-none">
								{faq.question}
								<ChevronDown
									className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
									aria-hidden="true"
								/>
							</summary>
							<p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{faq.answer}</p>
						</details>
					))}
				</div>
			</div>

			<script
				type="application/ld+json"
				// biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD with trusted translation content
				dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
			/>
		</section>
	)
}
