import { notFound } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'
import {
	buildComparisonMetadata,
	COMPARISON_SLUGS,
	COMPARISON_SPECS,
	ComparisonLanding,
	isComparisonSlug,
} from '@/features/marketing/components'
import { locales } from '@/lib/i18n/config'

type Props = {
	params: Promise<{ locale: string; rival: string }>
}

export function generateStaticParams() {
	return locales.flatMap((locale) => COMPARISON_SLUGS.map((rival) => ({ locale, rival })))
}

/** The spec for a known slug; anything else is a real 404, not an empty page. */
function requireSpec(rival: string) {
	if (!isComparisonSlug(rival)) notFound()
	return COMPARISON_SPECS[rival]
}

export async function generateMetadata({ params }: Props) {
	const { locale, rival } = await params
	return buildComparisonMetadata(locale, requireSpec(rival))
}

/** `/vs/<rival>`: one honest comparison page per slug in `COMPARISON_SLUGS`. */
export default async function ComparisonPage({ params }: Props) {
	const { locale, rival } = await params
	setRequestLocale(locale)
	return <ComparisonLanding spec={requireSpec(rival)} />
}
