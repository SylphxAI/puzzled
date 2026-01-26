'use client'

import { SecuritySettings } from '@sylphx/sdk/react'
import { Shield } from 'lucide-react'
import { useTranslations } from 'next-intl'

/**
 * Security Settings Client Component
 *
 * Uses the SDK's SecuritySettings component for:
 * - Two-factor authentication setup
 * - Active sessions management
 * - Login history
 */
export function SecuritySettingsContent() {
	const t = useTranslations('settings')

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

			{/* SDK Security Settings Component */}
			<div className="rounded-2xl border bg-card overflow-hidden p-6">
				<SecuritySettings />
			</div>
		</div>
	)
}
