'use client'

import { AccountSection } from '@sylphx/sdk/react'
import { UserCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { SettingsPageHeader } from '@/shared/components/layout'

/**
 * Account Settings Client Component
 *
 * Uses the SDK's AccountSection component for:
 * - Email management
 * - Password change
 * - Connected accounts
 * - Account deletion
 */
export function AccountSettingsContent() {
	const t = useTranslations('settings')

	return (
		<div className="space-y-6">
			<SettingsPageHeader
				icon={UserCircle}
				gradientClasses="from-primary/20 to-blue-500/20"
				iconColorClass="text-primary"
				title={t('account.title')}
				description={t('account.description')}
			/>

			<div className="rounded-2xl border bg-card overflow-hidden p-6">
				<AccountSection />
			</div>
		</div>
	)
}
