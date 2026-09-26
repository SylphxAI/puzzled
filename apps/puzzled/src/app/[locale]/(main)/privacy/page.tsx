export const dynamic = 'force-dynamic'

import { ArrowRight } from 'lucide-react'
import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { MarketingCta, MarketingHero } from '@/features/marketing/components'
import { LegalDocument, type LegalSection } from '@/features/marketing/components/legal-document'
import { PRIVACY_EMAIL } from '@/lib/config/app'
import { Link } from '@/lib/i18n/routing'
import { buildPageMetadata, ogImagePath } from '@/lib/seo/metadata'

type Props = {
	params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { locale } = await params
	const t = await getTranslations({ locale, namespace: 'legal.privacy' })

	return buildPageMetadata({
		locale,
		path: '/privacy',
		title: t('title'),
		description: t('lead'),
		imagePath: ogImagePath({
			title: t('title'),
			subtitle: t('lead'),
			eyebrow: t('eyebrow'),
		}),
	})
}

/** Third-party rows keep the published "<strong>Stripe</strong> - …" pairing. */
function thirdPartyRow(name: string, description: string) {
	return (
		<>
			<strong>{name}</strong> - {description}
		</>
	)
}

export default async function PrivacyPage({ params }: Props) {
	const { locale } = await params
	setRequestLocale(locale)

	const t = await getTranslations('legal.privacy')
	const tTerms = await getTranslations('legal.terms')
	// The revision is published data; without it the page shows no date at all.
	const revision = t.has('revision') ? t('revision') : undefined

	// Published section order; every sentence comes from legal.json.
	const sections: LegalSection[] = [
		{
			id: 'intro',
			title: t('sections.intro.title'),
			paragraphs: [t('sections.intro.content')],
		},
		{
			id: 'controller',
			title: t('sections.controller.title'),
			paragraphs: [t('sections.controller.content')],
		},
		{
			id: 'dataCollection',
			title: t('sections.dataCollection.title'),
			paragraphs: [t('sections.dataCollection.content')],
			bullets: [
				t('sections.dataCollection.items.account'),
				t('sections.dataCollection.items.game'),
				t('sections.dataCollection.items.payment'),
				t('sections.dataCollection.items.technical'),
				t('sections.dataCollection.items.referral'),
			],
		},
		{
			id: 'dataUse',
			title: t('sections.dataUse.title'),
			paragraphs: [t('sections.dataUse.content')],
			bullets: [
				t('sections.dataUse.items.service'),
				t('sections.dataUse.items.improve'),
				t('sections.dataUse.items.communicate'),
				t('sections.dataUse.items.legal'),
			],
		},
		{
			id: 'payments',
			title: t('sections.payments.title'),
			paragraphs: [t('sections.payments.content')],
		},
		{
			id: 'thirdParty',
			title: t('sections.thirdParty.title'),
			paragraphs: [t('sections.thirdParty.content')],
			bullets: [
				thirdPartyRow('Stripe', t('sections.thirdParty.stripe')),
				thirdPartyRow('Google', t('sections.thirdParty.google')),
				thirdPartyRow('Resend', t('sections.thirdParty.resend')),
			],
		},
		{
			id: 'cookies',
			title: t('sections.cookies.title'),
			paragraphs: [t('sections.cookies.content')],
		},
		{
			id: 'rights',
			title: t('sections.rights.title'),
			paragraphs: [t('sections.rights.content')],
			bullets: [
				t('sections.rights.items.access'),
				t('sections.rights.items.correct'),
				t('sections.rights.items.delete'),
				t('sections.rights.items.export'),
				t('sections.rights.items.complain'),
			],
		},
		{
			id: 'contact',
			title: t('sections.contact.title'),
			paragraphs: [t('sections.contact.content')],
			contactEmail: PRIVACY_EMAIL,
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
					href="/terms"
					className="inline-flex min-h-12 items-center gap-2 rounded-2xl border border-white/25 px-5 font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
				>
					{tTerms('title')}
					<ArrowRight className="h-4 w-4" aria-hidden="true" />
				</Link>
			</MarketingCta>
		</main>
	)
}
