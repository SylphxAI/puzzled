'use client'

import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { Switch } from '@sylphx/ui'
import { updatePrivacySettings } from '../actions/privacy-actions'

type PrivacyToggleProps = {
	// Note: marketingEmailsEnabled is managed in Notification Settings via notificationPreferences
	settingKey: 'isPublicProfile' | 'leaderboardVisible'
	initialValue: boolean
	label: string
	description: string
}

export function PrivacyToggle({
	settingKey,
	initialValue,
	label,
	description,
}: PrivacyToggleProps) {
	const t = useTranslations()
	const [checked, setChecked] = useState(initialValue)
	const [isPending, startTransition] = useTransition()
	const [error, setError] = useState<string | null>(null)

	const handleChange = (newValue: boolean) => {
		setChecked(newValue)
		setError(null)

		startTransition(async () => {
			try {
				await updatePrivacySettings({ [settingKey]: newValue })
			} catch (err) {
				setError(err instanceof Error ? err.message : t('settings.privacy.updateError'))
				// Revert on error
				setChecked(!newValue)
			}
		})
	}

	return (
		<div>
			<Switch
				checked={checked}
				onCheckedChange={handleChange}
				disabled={isPending}
				label={label}
				description={description}
			/>
			{error && <p className="mt-2 text-sm text-destructive">{error}</p>}
		</div>
	)
}
