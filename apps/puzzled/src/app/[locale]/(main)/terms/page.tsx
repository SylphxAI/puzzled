import { ArrowRight } from 'lucide-react'
import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { MarketingCta, MarketingHero } from '@/features/marketing/components'
import { LegalDocument, type LegalSection } from '@/features/marketing/components/legal-document'
import { LEGAL_EMAIL } from '@/lib/config/app'
import { Link } from '@/lib/i18n/routing'
import { buildPageMetadata, ogImagePath } from '@/lib/seo/metadata'

type Props = {
	params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { locale } = await params
	const t = await getTranslations({ locale, namespace: 'legal.terms' })

	return buildPageMetadata({
		locale,
		path: '/terms',
		title: t('title'),
		description: t('lead'),
		imagePath: ogImagePath({
			title: t('title'),
			subtitle: t('lead'),
			eyebrow: t('eyebrow'),
		}),
	})
}

export default async function TermsPage({ params }: Props) {
	const { locale } = await params
	setRequestLocale(locale)

	const t = await getTranslations('legal.terms')
	const tPrivacy = await getTranslations('legal.privacy')
	// The revision is published data; without it the page shows no date at all.
	const revision = t.has('revision') ? t('revision') : undefined

	// Published section order; every sentence comes from legal.json.
	const sections: LegalSection[] = [
		{
			id: 'acceptance',
			title: t('sections.acceptance.title'),
			paragraphs: [t('sections.acceptance.content')],
		},
		{
			id: 'service',
			title: t('sections.service.title'),
			paragraphs: [t('sections.service.content')],
		},
		{
			id: 'accounts',
			title: t('sections.accounts.title'),
			paragraphs: [t('sections.accounts.content')],
			bullets: [
				t('sections.accounts.items.accurate'),
				t('sections.accounts.items.secure'),
				t('sections.accounts.items.responsible'),
			],
		},
		{
			id: 'subscription',
			title: t('sections.subscription.title'),
			paragraphs: [t('sections.subscription.content')],
			bullets: [
				t('sections.subscription.items.billing'),
				t('sections.subscription.items.cancel'),
				t('sections.subscription.items.refund'),
			],
		},
		{
			id: 'conduct',
			title: t('sections.conduct.title'),
			paragraphs: [t('sections.conduct.content')],
			bullets: [
				t('sections.conduct.items.legal'),
				t('sections.conduct.items.respect'),
				t('sections.conduct.items.noCheat'),
			],
		},
		{
			id: 'ip',
			title: t('sections.ip.title'),
			paragraphs: [t('sections.ip.content')],
		},
		{
			id: 'disclaimer',
			title: t('sections.disclaimer.title'),
			paragraphs: [t('sections.disclaimer.content')],
		},
		{
			id: 'liability',
			title: t('sections.liability.title'),
			paragraphs: [t('sections.liability.content')],
		},
		{
			id: 'changes',
			title: t('sections.changes.title'),
			paragraphs: [t('sections.changes.content')],
		},
		{
			id: 'contact',
			title: t('sections.contact.title'),
			paragraphs: [t('sections.contact.content')],
			contactEmail: LEGAL_EMAIL,
		},
	]

	return (
		<main className="flex-1">
			<MarketingHero eyebrow={t('eyebrow')} title={t('title')} lead={t('lead')} />

			<LegalDocument
				locale={locale}
				revision={revision}
				lastUpdatedLabel={t('lastUpdated')}
				tocTitle={t('toc.title')}
				sections={sections}
			/>

			<MarketingCta title={t('cta.title')} body={t('cta.body')}>
				<Link
					href="/support"
					className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-white px-6 font-semibold text-ink transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-[0.98]"
				>
					{t('cta.support')}
					<ArrowRight className="h-4 w-4" aria-hidden="true" />
				</Link>
				<Link
					href="/privacy"
					className="inline-flex min-h-12 items-center gap-2 rounded-2xl border border-white/25 px-5 font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
				>
					{tPrivacy('title')}
					<ArrowRight className="h-4 w-4" aria-hidden="true" />
				</Link>
			</MarketingCta>
		</main>
	)
}
