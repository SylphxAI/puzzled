import { setRequestLocale } from 'next-intl/server'
import {
	buildComparisonMetadata,
	COMPARISON_SPECS,
	ComparisonLanding,
} from '@/features/marketing/components'

const SPEC = COMPARISON_SPECS.lumosity

type Props = {
	params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props) {
	const { locale } = await params
	return buildComparisonMetadata(locale, SPEC)
}

export default async function TryitVsLumosityPage({ params }: Props) {
	const { locale } = await params
	setRequestLocale(locale)
	return <ComparisonLanding spec={SPEC} />
}
