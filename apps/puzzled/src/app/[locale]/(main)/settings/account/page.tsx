import { Key, Link2, Mail, UserCircle } from 'lucide-react'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import {
	ConnectedAccounts,
	EmailChange,
	GameSettingsCard,
	PasswordSection,
} from '@/features/settings/components'

type Props = {
	params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props) {
	const { locale } = await params
	const t = await getTranslations({ locale, namespace: 'settings' })

	return {
		title: t('account.title'),
	}
}

export default async function AccountSettingsPage({ params }: Props) {
	const { locale } = await params
	setRequestLocale(locale)

	// Auth is handled by layout - no need to check here
	const t = await getTranslations('settings')

	return (
		<div className="space-y-6">
			{/* Page Header */}
			<div className="flex items-center gap-3">
				<div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-blue-500/20">
					<UserCircle className="h-6 w-6 text-primary" />
				</div>
				<div>
					<h1 className="text-xl font-semibold tracking-tight">{t('account.title')}</h1>
					<p className="text-sm text-muted-foreground">{t('account.description')}</p>
				</div>
			</div>

			{/* Email Section */}
			<GameSettingsCard
				title={t('email.title')}
				description={t('email.description')}
				iconElement={<Mail className="h-5 w-5 text-primary" />}
				variant="default"
			>
				<EmailChange />
			</GameSettingsCard>

			{/* Connected Accounts Section */}
			<GameSettingsCard
				title={t('connectedAccounts.title')}
				description={t('account.connectedAccountsDescription')}
				iconElement={<Link2 className="h-5 w-5 text-primary" />}
				variant="default"
			>
				<ConnectedAccounts />
			</GameSettingsCard>

			{/* Password Section */}
			<GameSettingsCard
				title={t('account.password.title')}
				description={t('account.password.description')}
				iconElement={<Key className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />}
				variant="security"
			>
				<PasswordSection />
			</GameSettingsCard>
		</div>
	)
}
