import { count, eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getAuthState, getSecurityScore, getServerUser } from '@/features/auth/server'
import { SettingsOverview } from '@/features/settings/components/settings-overview'
import { getNotificationPreferences } from '@/features/settings/server'
import { getUserSubscription } from '@/features/subscription/server'
import { db } from '@/lib/db'
import { accounts, userStats, userStreaks } from '@/lib/db/schema'

type Props = {
	params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props) {
	const { locale } = await params
	const t = await getTranslations({ locale, namespace: 'common' })
	return {
		title: t('settings'),
	}
}

export default async function SettingsOverviewPage({ params }: Props) {
	const { locale } = await params
	setRequestLocale(locale)

	const user = await getServerUser()

	if (!user) {
		redirect(`/${locale}/login?callbackUrl=/settings`)
	}

	const userId = user.id

	// Fetch user stats, streak, auth state (SSOT for security), subscription, and notification preferences in parallel
	const [stats, streak, connectedAccountsResult, authState, subscription, notificationPrefs] =
		await Promise.all([
			db.query.userStats.findFirst({
				where: eq(userStats.userId, userId),
			}),
			db.query.userStreaks.findFirst({
				where: eq(userStreaks.userId, userId),
			}),
			db.select({ count: count() }).from(accounts).where(eq(accounts.userId, userId)),
			getAuthState(userId),
			getUserSubscription(userId),
			getNotificationPreferences(),
		])

	// Use SSOT security score calculation
	const securityScore = getSecurityScore(authState)
	const accountCount = connectedAccountsResult[0]?.count ?? 0

	// Check if user has played today
	const today = new Date()
	today.setHours(0, 0, 0, 0)
	const hasPlayedToday = streak?.lastPlayedDate ? new Date(streak.lastPlayedDate) >= today : false

	return (
		<SettingsOverview
			stats={
				stats
					? {
							currentStreak: streak?.currentStreak ?? 0,
							maxStreak: streak?.maxStreak ?? 0,
							totalWins: stats.gamesWon,
							gamesPlayed: stats.gamesPlayed,
						}
					: undefined
			}
			subscription={subscription}
			securityScore={securityScore}
			connectedAccounts={accountCount}
			hasPlayedToday={hasPlayedToday}
			notificationPreferences={notificationPrefs}
		/>
	)
}
