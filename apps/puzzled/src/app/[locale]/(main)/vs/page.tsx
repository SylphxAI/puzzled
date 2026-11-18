import { setRequestLocale } from 'next-intl/server'
import { buildComparisonHubMetadata, ComparisonHub } from '@/features/marketing/components'

type Props = {
	params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props) {
	const { locale } = await params
	return buildComparisonHubMetadata(locale)
}

/** `/vs`: every Tryit comparison on one page. */
export default async function ComparisonHubPage({ params }: Props) {
	const { locale } = await params
	setRequestLocale(locale)
	return <ComparisonHub />
}
