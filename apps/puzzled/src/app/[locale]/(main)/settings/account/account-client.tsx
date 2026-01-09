'use client'

import { UserCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { AccountSection } from '@sylphx/platform-sdk/react'

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

			{/* SDK Account Section Component */}
			<div className="rounded-2xl border bg-card overflow-hidden p-6">
				<AccountSection />
			</div>
		</div>
	)
}
