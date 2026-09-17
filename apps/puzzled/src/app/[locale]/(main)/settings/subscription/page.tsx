export const dynamic = 'force-dynamic'

import { getTranslations, setRequestLocale } from 'next-intl/server'
import { requireMember } from '@/features/console/lib/require-member'
import { getSubscription } from '@/lib/identity'
import { withPresentationDeadline } from '@/lib/presentation-document'
import { getSdkConfig } from '@/lib/sdk-server'
import { buildPageMetadata } from '@/lib/seo/metadata'
import { SubscriptionSettingsContent } from './subscription-client'

type Props = {
	params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props) {
	const { locale } = await params
	const t = await getTranslations({ locale, namespace: 'settings' })

	return buildPageMetadata({
		locale,
		path: '/settings/subscription',
		title: t('subscription.title'),
		description: t('subscription.description'),
		noindex: true,
	})
}

/**
 * Plan and billing.
 *
 * The plan state is read from the entitlement authority as a projection that
 * throws when the authority does not answer, which is what lets this page tell
 * "free" apart from "we could not read your entitlement". Nothing here grants
 * or changes access: the actions hand off to the billing portal.
 */
export default async function SubscriptionSettingsPage({ params }: Props) {
	const { locale } = await params
	setRequestLocale(locale)

	const user = await requireMember({ locale, returnTo: '/settings/subscription' })
	if (!user) return null
	const subscription = user?.id
		? await withPresentationDeadline(getSubscription(getSdkConfig(), user.id), null)
		: null
	// `status: 'active'` is the same `enabled` signal the premium writer reads.
	const premium = subscription === null ? null : subscription.status === 'active'

	return <SubscriptionSettingsContent premium={premium} />
}
