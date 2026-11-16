import { setRequestLocale } from 'next-intl/server'
import {
	buildUseCaseMetadata,
	USE_CASE_SPECS,
	UseCaseLanding,
} from '@/features/marketing/components'

const SPEC = USE_CASE_SPECS['family-brain-games-no-ads']

type Props = {
	params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props) {
	const { locale } = await params
	return buildUseCaseMetadata(locale, SPEC)
}

export default async function FamilyBrainGamesNoAdsPage({ params }: Props) {
	const { locale } = await params
	setRequestLocale(locale)
	return <UseCaseLanding spec={SPEC} />
}
