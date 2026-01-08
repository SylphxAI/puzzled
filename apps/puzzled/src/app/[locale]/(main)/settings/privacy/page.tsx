import { eq } from 'drizzle-orm'
import { AlertTriangle, BarChart3, Download, Eye, Shield } from 'lucide-react'
import { redirect } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { requireServerUser } from '@/features/auth/server'
import {
	DataExport,
	DeleteAccountButton,
	GameSettingsCard,
	PrivacyToggle,
} from '@/features/settings/components'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'

type Props = {
	params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props) {
	const { locale } = await params
	const t = await getTranslations({ locale, namespace: 'settings.privacy' })

	return {
		title: t('title'),
	}
}

export default async function PrivacySettingsPage({ params }: Props) {
	const { locale } = await params
	setRequestLocale(locale)

	// Auth is handled by layout, but we need user.id for DB query
	const sessionUser = await requireServerUser(locale)
	const t = await getTranslations()

	// Fetch full user data including privacy settings
	const user = await db.query.users.findFirst({
		where: eq(users.id, sessionUser.id),
	})

	if (!user) {
		redirect(`/${locale}/login`)
	}

	return (
		<div className="space-y-6">
			{/* Page Header */}
			<div className="flex items-center gap-3">
				<div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500/20 to-cyan-500/20">
					<Shield className="h-6 w-6 text-teal-500" />
				</div>
				<div>
					<h1 className="text-xl font-semibold tracking-tight">{t('settings.privacy.title')}</h1>
					<p className="text-sm text-muted-foreground">{t('settings.privacy.description')}</p>
				</div>
			</div>

			{/* Profile Visibility */}
			<GameSettingsCard
				title={t('settings.privacy.profileVisibility.title')}
				description={t('settings.privacy.profileVisibility.description')}
				iconElement={<Eye className="h-5 w-5 text-primary" />}
				variant="default"
			>
				<div className="space-y-4">
					<PrivacyToggle
						settingKey="isPublicProfile"
						initialValue={user.isPublicProfile ?? false}
						label={t('settings.privacy.profileVisibility.publicProfile')}
						description={t('settings.privacy.profileVisibility.publicProfileDescription', {
							username: user.username ?? 'username',
						})}
					/>

					<div className="rounded-xl border bg-muted/30 p-4">
						<div className="mb-2 flex items-start gap-3">
							<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
								<Eye className="h-4 w-4 text-primary" />
							</div>
							<div className="flex-1">
								<p className="text-sm font-medium">
									{t('settings.privacy.profileVisibility.visibleWhenPublic')}
								</p>
								<ul className="mt-2 grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
									<li className="flex items-center gap-2">
										<span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
										{t('settings.privacy.profileVisibility.visibleName')}
									</li>
									<li className="flex items-center gap-2">
										<span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
										{t('settings.privacy.profileVisibility.visibleUsername')}
									</li>
									<li className="flex items-center gap-2">
										<span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
										{t('settings.privacy.profileVisibility.visibleStats')}
									</li>
									<li className="flex items-center gap-2">
										<span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
										{t('settings.privacy.profileVisibility.visibleAchievements')}
									</li>
								</ul>
							</div>
						</div>
					</div>

					<PrivacyToggle
						settingKey="leaderboardVisible"
						initialValue={user.leaderboardVisible ?? true}
						label={t('settings.privacy.profileVisibility.leaderboardVisibility')}
						description={t('settings.privacy.profileVisibility.leaderboardDescription')}
					/>
				</div>
			</GameSettingsCard>

			{/* Data Management */}
			<GameSettingsCard
				title={t('settings.privacy.dataManagement.title')}
				description={t('settings.privacy.dataManagement.description')}
				iconElement={<Download className="h-5 w-5 text-primary" />}
				variant="default"
			>
				<DataExport />
			</GameSettingsCard>

			{/* Analytics */}
			<GameSettingsCard
				title={t('settings.privacy.analytics.title')}
				description={t('settings.privacy.analytics.description')}
				iconElement={<BarChart3 className="h-5 w-5 text-primary" />}
				variant="default"
			>
				<div className="rounded-xl border bg-muted/30 p-4">
					<div className="flex items-start gap-3">
						<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
							<BarChart3 className="h-4 w-4 text-blue-500" />
						</div>
						<div className="flex-1">
							<p className="text-sm font-medium">{t('settings.privacy.analytics.whatWeCollect')}</p>
							<p className="mt-1 text-sm text-muted-foreground">
								{t('settings.privacy.analytics.collectionDescription')}
							</p>
							<ul className="mt-3 grid gap-1.5 text-sm text-muted-foreground sm:grid-cols-2">
								<li className="flex items-center gap-2">
									<span className="h-1.5 w-1.5 rounded-full bg-blue-500/60" />
									{t('settings.privacy.analytics.collectGamePlay')}
								</li>
								<li className="flex items-center gap-2">
									<span className="h-1.5 w-1.5 rounded-full bg-blue-500/60" />
									{t('settings.privacy.analytics.collectPerformance')}
								</li>
								<li className="flex items-center gap-2">
									<span className="h-1.5 w-1.5 rounded-full bg-blue-500/60" />
									{t('settings.privacy.analytics.collectErrors')}
								</li>
							</ul>
							<p className="mt-3 rounded-lg bg-muted/50 p-2 text-xs text-muted-foreground">
								{t('settings.privacy.analytics.noPersonalData')}
							</p>
						</div>
					</div>
				</div>
			</GameSettingsCard>

			{/* Danger Zone */}
			<GameSettingsCard
				title={t('settings.privacy.deleteAccount.dangerZone')}
				description={t('settings.privacy.deleteAccount.dangerZoneDescription')}
				iconElement={<AlertTriangle className="h-5 w-5 text-destructive" />}
				variant="danger"
			>
				<div className="space-y-4">
					<div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
						<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
							<AlertTriangle className="h-4 w-4 text-destructive" />
						</div>
						<div>
							<p className="font-medium text-destructive">
								{t('settings.privacy.deleteAccount.permanentAction')}
							</p>
							<p className="mt-1 text-sm text-muted-foreground">
								{t('settings.privacy.deleteAccount.permanentActionDescription')}
							</p>
						</div>
					</div>

					<DeleteAccountButton />
				</div>
			</GameSettingsCard>
		</div>
	)
}
