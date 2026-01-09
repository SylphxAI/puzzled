'use client'

import { UserCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { UserProfile } from '@sylphx/platform-sdk/react'

/**
 * Profile Settings Client Component
 *
 * Uses the SDK's UserProfile component for profile management.
 * Includes avatar upload, name editing, and profile updates.
 */
export function ProfileSettingsContent() {
	const t = useTranslations('settings')

	return (
		<div className="space-y-6">
			{/* Page Header */}
			<div className="flex items-center gap-3">
				<div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500/20 to-pink-500/20">
					<UserCircle className="h-6 w-6 text-rose-500" />
				</div>
				<div>
					<h1 className="text-xl font-semibold tracking-tight">{t('profile.title')}</h1>
					<p className="text-sm text-muted-foreground">{t('profile.description')}</p>
				</div>
			</div>

			{/* SDK UserProfile Component */}
			<div className="rounded-2xl border bg-card overflow-hidden">
				<UserProfile
					sections={['profile']}
					showCard={false}
					header={null}
				/>
			</div>
		</div>
	)
}
