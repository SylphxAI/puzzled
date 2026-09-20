'use client'

import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useState } from 'react'
import { type PuzzledNotificationPreferences, usePuzzledPush } from '../hooks/use-puzzled-push'

interface NotificationPreferencesProps {
	/** Callback when preferences are saved */
	onSave?: (preferences: PuzzledNotificationPreferences) => void
	/** Show as compact inline or full settings panel */
	variant?: 'inline' | 'panel'
	/** Custom class name */
	className?: string
}

/**
 * Ids the panel's push switch takes its accessible name and description from.
 *
 * The switch has no text of its own, so it is named by the heading and
 * description it controls rather than by a decorative child. The panel renders
 * once per settings page, so the ids are fixed rather than generated.
 */
const PUSH_HEADING_ID = 'push-notifications-heading'
const PUSH_DESCRIPTION_ID = 'push-notifications-description'

/**
 * Notification preferences UI
 *
 * Allows users to customize which notifications they receive.
 *
 * Every string comes from the 'settings' message catalogue
 * (`settings.notifications.push.*`) so the surface is localized like the rest
 * of the console.
 *
 * @example
 * ```tsx
 * <NotificationPreferences onSave={(prefs) => console.log(prefs)} />
 * ```
 */
export function NotificationPreferences({
	onSave,
	variant = 'panel',
	className,
}: NotificationPreferencesProps) {
	const t = useTranslations('settings')
	const {
		isSupported,
		isEnabled,
		requestPermission,
		disablePush,
		preferences,
		updatePreferences,
		error,
		isLoadingPreferences,
	} = usePuzzledPush()

	const [localPrefs, setLocalPrefs] = useState<PuzzledNotificationPreferences>(preferences)
	const [isSaving, setIsSaving] = useState(false)

	// Sync local state when server preferences load
	useEffect(() => {
		setLocalPrefs(preferences)
	}, [preferences])

	const handleToggle = useCallback((key: keyof PuzzledNotificationPreferences) => {
		setLocalPrefs((prev) => ({
			...prev,
			[key]: typeof prev[key] === 'boolean' ? !prev[key] : prev[key],
		}))
	}, [])

	const handleSave = async () => {
		setIsSaving(true)
		try {
			await updatePreferences(localPrefs)
			onSave?.(localPrefs)
		} finally {
			setIsSaving(false)
		}
	}

	const handleEnablePush = async () => {
		await requestPermission()
	}

	const handleDisablePush = async () => {
		await disablePush()
	}

	if (!isSupported) {
		return (
			<div className={className}>
				<p className="text-muted-foreground text-sm">{t('notifications.push.unsupported')}</p>
			</div>
		)
	}

	const PreferenceItem = ({
		label,
		description,
		checked,
		onChange,
		disabled,
	}: {
		label: string
		description: string
		checked: boolean
		onChange: () => void
		disabled?: boolean
	}) => (
		<label className="flex items-start gap-3 py-3 cursor-pointer">
			<input
				type="checkbox"
				checked={checked}
				onChange={onChange}
				disabled={disabled}
				className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary disabled:opacity-50"
			/>
			<div className="flex-1">
				<p className="text-sm font-medium">{label}</p>
				<p className="text-xs text-muted-foreground">{description}</p>
			</div>
		</label>
	)

	if (variant === 'inline') {
		return (
			<div className={className}>
				<div className="flex items-center justify-between">
					<div>
						<p className="text-sm font-medium">{t('notifications.push.heading')}</p>
						<p className="text-xs text-muted-foreground">
							{isEnabled
								? t('notifications.push.inlineEnabled')
								: t('notifications.push.inlineDisabled')}
						</p>
					</div>
					<button
						type="button"
						onClick={isEnabled ? handleDisablePush : handleEnablePush}
						className={`px-3 py-1.5 text-sm font-medium rounded-md ${
							isEnabled
								? 'bg-muted text-muted-foreground hover:bg-muted/80'
								: 'bg-primary text-primary-foreground hover:bg-primary/90'
						}`}
					>
						{isEnabled ? t('notifications.push.disable') : t('notifications.push.enable')}
					</button>
				</div>
			</div>
		)
	}

	return (
		<div className={className}>
			{/* Main toggle */}
			<div className="flex items-center justify-between pb-4 border-b">
				<div>
					<h3 id={PUSH_HEADING_ID} className="text-base font-semibold">
						{t('notifications.push.heading')}
					</h3>
					<p id={PUSH_DESCRIPTION_ID} className="text-sm text-muted-foreground">
						{t('notifications.push.description')}
					</p>
				</div>
				<button
					type="button"
					role="switch"
					aria-checked={isEnabled}
					aria-labelledby={PUSH_HEADING_ID}
					aria-describedby={PUSH_DESCRIPTION_ID}
					onClick={isEnabled ? handleDisablePush : handleEnablePush}
					className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
						isEnabled ? 'bg-primary' : 'bg-muted'
					}`}
				>
					<span
						className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
							isEnabled ? 'translate-x-6' : 'translate-x-1'
						}`}
					/>
				</button>
			</div>

			{error && (
				<div className="mt-4 p-3 bg-destructive/10 text-destructive text-sm rounded-md">
					{error.message}
				</div>
			)}

			{/* Preferences - only show if enabled */}
			{isEnabled && (
				<div className="mt-4 space-y-1">
					<h4 className="text-sm font-medium mb-2">{t('notifications.push.typesHeading')}</h4>

					{isLoadingPreferences ? (
						<div className="py-8 text-center text-muted-foreground text-sm">
							{t('notifications.push.loading')}
						</div>
					) : (
						<>
							<PreferenceItem
								label={t('notifications.push.dailyReminder')}
								description={t('notifications.push.dailyReminderDescription')}
								checked={localPrefs.pushDailyReminder}
								onChange={() => handleToggle('pushDailyReminder')}
							/>

							<PreferenceItem
								label={t('notifications.push.streakAlert')}
								description={t('notifications.push.streakAlertDescription')}
								checked={localPrefs.pushStreakAlert}
								onChange={() => handleToggle('pushStreakAlert')}
							/>

							<PreferenceItem
								label={t('notifications.push.newGames')}
								description={t('notifications.push.newGamesDescription')}
								checked={localPrefs.pushNewGames}
								onChange={() => handleToggle('pushNewGames')}
							/>

							<div className="pt-4">
								<button
									type="button"
									onClick={handleSave}
									disabled={isSaving}
									className="w-full px-4 py-2 bg-primary text-primary-foreground font-medium rounded-md hover:bg-primary/90 disabled:opacity-50"
								>
									{isSaving ? t('notifications.push.saving') : t('notifications.push.save')}
								</button>
							</div>
						</>
					)}
				</div>
			)}

			{/* Not enabled state */}
			{!isEnabled && (
				<div className="mt-6 text-center py-8">
					<div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
						<BellIcon className="w-8 h-8 text-muted-foreground" />
					</div>
					<p className="text-sm text-muted-foreground mb-4">
						{t('notifications.push.enablePrompt')}
					</p>
					<button
						type="button"
						onClick={handleEnablePush}
						className="px-4 py-2 bg-primary text-primary-foreground font-medium rounded-md hover:bg-primary/90"
					>
						{t('notifications.push.enableNotifications')}
					</button>
				</div>
			)}
		</div>
	)
}

function BellIcon({ className }: { className?: string }) {
	return (
		<svg
			className={className}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			aria-hidden="true"
		>
			<path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
			<path d="M13.73 21a2 2 0 01-3.46 0" />
		</svg>
	)
}
