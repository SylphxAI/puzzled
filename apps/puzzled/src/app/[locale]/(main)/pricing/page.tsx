import { getPlans } from '@sylphx/sdk/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Header } from '@/shared/components/layout'
import { PricingContent } from './pricing-client'

type Props = {
	params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props) {
	const { locale } = await params
	const t = await getTranslations({ locale, namespace: 'subscription' })

	return {
		title: t('premium'),
	}
}

export default async function PricingPage({ params }: Props) {
	const { locale } = await params
	setRequestLocale(locale)

	const plans = await getPlans({
		appId: process.env.NEXT_PUBLIC_SYLPHX_APP_ID!,
		appSecret: process.env.SYLPHX_SECRET_KEY!,
		platformUrl: process.env.NEXT_PUBLIC_SYLPHX_URL,
	})

	return (
		<>
			<Header />
			<main className="flex flex-1 flex-col px-4 py-8 pb-nav">
				<PricingContent locale={locale} initialPlans={plans} />
			</main>
		</>
	)
}
