import { Clock, History, Shield, ShieldCheck } from 'lucide-react'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { MfaSetup } from '@/features/auth/components'
import {
	GameSettingsCard,
	LoginHistory,
	SecurityCheckup,
	SessionManager,
} from '@/features/settings/components'

type Props = {
	params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props) {
	const { locale } = await params
	const t = await getTranslations({ locale, namespace: 'settings' })

	return {
		title: t('security.title'),
	}
}

export default async function SecuritySettingsPage({ params }: Props) {
	const { locale } = await params
	setRequestLocale(locale)

	// Auth is handled by layout - no need to check here
	const t = await getTranslations('settings')

	return (
		<div className="space-y-6">
			{/* Page Header */}
			<div className="flex items-center gap-3">
				<div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20">
					<Shield className="h-6 w-6 text-emerald-500" />
				</div>
				<div>
					<h1 className="text-xl font-semibold tracking-tight">{t('security.title')}</h1>
					<p className="text-sm text-muted-foreground">{t('security.description')}</p>
				</div>
			</div>

			{/* Security Score */}
			<GameSettingsCard
				title={t('security.securityCheckup.title')}
				description={t('security.securityCheckup.description')}
				iconElement={<ShieldCheck className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />}
				variant="security"
			>
				<SecurityCheckup />
			</GameSettingsCard>

			{/* Two-Factor Authentication */}
			<GameSettingsCard
				title={t('security.twoFactorAuth')}
				description={t('security.twoFactorDescription')}
				iconElement={<Shield className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />}
				variant="security"
			>
				<MfaSetup />
			</GameSettingsCard>

			{/* Active Sessions */}
			<GameSettingsCard
				title={t('security.sessions.title')}
				description={t('security.sessions.description')}
				iconElement={<Clock className="h-5 w-5 text-primary" />}
				variant="default"
			>
				<SessionManager />
			</GameSettingsCard>

			{/* Login History - Collapsible for progressive disclosure */}
			<GameSettingsCard
				title={t('security.loginHistory.title')}
				description={t('security.loginHistory.description')}
				iconElement={<History className="h-5 w-5 text-primary" />}
				variant="default"
				collapsible
				defaultOpen={false}
			>
				<LoginHistory />
			</GameSettingsCard>
		</div>
	)
}
