/**
 * Notification Settings Component
 *
 * Push and email notification preferences management.
 * Self-contained with CSS-in-JS styles.
 */

'use client'

import { useState, useEffect } from 'react'
import type { ThemeVariables } from './styles'
import {
	defaultTheme,
	baseStyles,
	mergeStyles,
	injectGlobalStyles,
} from './styles'
import { useNotifications } from '../platform-hooks'

export interface NotificationSettingsProps {
	/** Theme variables */
	theme?: ThemeVariables
	/** Called on successful update */
	onSuccess?: (message: string) => void
	/** Called on error */
	onError?: (error: string) => void
	/** Custom class name */
	className?: string
	/** Show push notification settings */
	showPush?: boolean
	/** Show email notification settings */
	showEmail?: boolean
}

/**
 * Notification preferences component
 *
 * @example
 * ```tsx
 * <NotificationSettings
 *   onSuccess={(msg) => toast.success(msg)}
 *   onError={(msg) => toast.error(msg)}
 * />
 * ```
 */
export function NotificationSettings({
	theme = defaultTheme,
	onSuccess,
	onError,
	className,
	showPush = true,
	showEmail = true,
}: NotificationSettingsProps) {
	const {
		isSupported,
		isSubscribed,
		preferences,
		error: pushError,
		subscribe,
		unsubscribe,
		updatePreferences,
	} = useNotifications()
	const styles = baseStyles(theme)

	const [error, setError] = useState<string | null>(null)
	const [success, setSuccess] = useState<string | null>(null)
	const [isTogglingPush, setIsTogglingPush] = useState(false)
	const [localPrefs, setLocalPrefs] = useState<Record<string, boolean>>(() =>
		preferences?.categories ?? {}
	)

	// Inject global styles
	useEffect(() => {
		injectGlobalStyles()
	}, [])

	// Sync preferences
	useEffect(() => {
		if (preferences?.categories) {
			setLocalPrefs(preferences.categories)
		}
	}, [preferences])

	// Clear messages after timeout
	useEffect(() => {
		if (success || error) {
			const timer = setTimeout(() => {
				setSuccess(null)
				setError(null)
			}, 5000)
			return () => clearTimeout(timer)
		}
	}, [success, error])

	// Toggle push notifications
	const handleTogglePush = async () => {
		setIsTogglingPush(true)
		setError(null)

		try {
			if (isSubscribed) {
				await unsubscribe()
				setSuccess('Push notifications disabled')
				onSuccess?.('Push notifications disabled')
			} else {
				const result = await subscribe()
				if (result) {
					setSuccess('Push notifications enabled')
					onSuccess?.('Push notifications enabled')
				} else {
					setError('Failed to enable push notifications. Please check your browser permissions.')
					onError?.('Failed to enable push notifications')
				}
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to toggle push notifications'
			setError(message)
			onError?.(message)
		} finally {
			setIsTogglingPush(false)
		}
	}

	// Update email preferences
	const handlePreferenceChange = async (key: string, value: boolean) => {
		const newPrefs = { ...localPrefs, [key]: value }
		setLocalPrefs(newPrefs)

		try {
			await updatePreferences({ categories: newPrefs })
			setSuccess('Preferences updated')
			onSuccess?.('Preferences updated')
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to update preferences'
			setError(message)
			onError?.(message)
			// Revert on error
			setLocalPrefs(localPrefs)
		}
	}

	const cardStyles: React.CSSProperties = mergeStyles(styles.card, {
		padding: '1rem',
		marginBottom: '1rem',
	})

	return (
		<div className={className}>
			{/* Alerts */}
			{success && (
				<div style={mergeStyles(styles.alert, styles.alertSuccess, styles.mb4)}>
					{success}
				</div>
			)}
			{(error || pushError) && (
				<div style={mergeStyles(styles.alert, styles.alertError, styles.mb4)}>
					{error || pushError?.message}
				</div>
			)}

			{/* Push Notifications */}
			{showPush && (
				<div style={cardStyles}>
					<div style={styles.flexBetween}>
						<div>
							<h4 style={{ margin: 0, fontWeight: 500 }}>Push Notifications</h4>
							<p style={mergeStyles(styles.textSm, styles.textMuted, { margin: '0.25rem 0 0' })}>
								{isSupported
									? isSubscribed
										? 'Receive instant notifications in your browser'
										: 'Enable browser push notifications'
									: 'Push notifications are not supported in this browser'}
							</p>
						</div>
						<ToggleSwitch
							checked={isSubscribed}
							disabled={!isSupported || isTogglingPush}
							onChange={handleTogglePush}
							theme={theme}
						/>
					</div>

					{!isSupported && (
						<div
							style={mergeStyles(styles.alert, styles.alertWarning, {
								marginTop: '1rem',
								marginBottom: 0,
							})}
						>
							<BellOffIcon size={16} />
							<span style={{ marginLeft: '0.5rem' }}>
								Your browser doesn't support push notifications
							</span>
						</div>
					)}
				</div>
			)}

			{/* Email Notifications */}
			{showEmail && (
				<div style={cardStyles}>
					<h4 style={{ margin: '0 0 1rem', fontWeight: 500 }}>Email Notifications</h4>

					{/* Marketing emails */}
					<div
						style={mergeStyles(styles.flexBetween, {
							padding: '0.75rem 0',
							borderBottom: `1px solid ${theme.colorBorder}`,
						})}
					>
						<div>
							<div style={{ fontWeight: 500, fontSize: theme.fontSizeSm }}>Marketing & Promotions</div>
							<div style={mergeStyles(styles.textXs, styles.textMuted)}>
								New features, tips, and special offers
							</div>
						</div>
						<ToggleSwitch
							checked={localPrefs.emailMarketing ?? true}
							onChange={(checked) => handlePreferenceChange('emailMarketing', checked)}
							theme={theme}
						/>
					</div>

					{/* Weekly summary */}
					<div
						style={mergeStyles(styles.flexBetween, {
							padding: '0.75rem 0',
							borderBottom: `1px solid ${theme.colorBorder}`,
						})}
					>
						<div>
							<div style={{ fontWeight: 500, fontSize: theme.fontSizeSm }}>Weekly Summary</div>
							<div style={mergeStyles(styles.textXs, styles.textMuted)}>
								Weekly digest of your activity
							</div>
						</div>
						<ToggleSwitch
							checked={localPrefs.emailWeeklySummary ?? true}
							onChange={(checked) => handlePreferenceChange('emailWeeklySummary', checked)}
							theme={theme}
						/>
					</div>

					{/* Daily reminder */}
					<div
						style={mergeStyles(styles.flexBetween, {
							padding: '0.75rem 0',
						})}
					>
						<div>
							<div style={{ fontWeight: 500, fontSize: theme.fontSizeSm }}>Daily Reminders</div>
							<div style={mergeStyles(styles.textXs, styles.textMuted)}>
								Push notifications for daily reminders
							</div>
						</div>
						<ToggleSwitch
							checked={localPrefs.pushDailyReminder ?? true}
							onChange={(checked) => handlePreferenceChange('pushDailyReminder', checked)}
							theme={theme}
						/>
					</div>
				</div>
			)}

			{/* Notification Types Legend */}
			<div style={mergeStyles(styles.textXs, styles.textMuted, styles.textCenter)}>
				<p style={{ margin: 0 }}>
					Security notifications cannot be fully disabled to keep your account safe.
				</p>
			</div>
		</div>
	)
}

// Toggle switch component
function ToggleSwitch({
	checked,
	onChange,
	disabled = false,
	theme,
}: {
	checked: boolean
	onChange: (checked: boolean) => void
	disabled?: boolean
	theme: ThemeVariables
}) {
	const trackStyle: React.CSSProperties = {
		width: '2.75rem',
		height: '1.5rem',
		borderRadius: '9999px',
		backgroundColor: checked ? theme.colorPrimary : theme.colorMuted,
		padding: '0.125rem',
		cursor: disabled ? 'not-allowed' : 'pointer',
		transition: 'background-color 0.15s ease-in-out',
		opacity: disabled ? 0.5 : 1,
		border: checked ? 'none' : `1px solid ${theme.colorBorder}`,
	}

	const thumbStyle: React.CSSProperties = {
		width: '1.25rem',
		height: '1.25rem',
		borderRadius: '50%',
		backgroundColor: '#fff',
		boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
		transform: checked ? 'translateX(1.25rem)' : 'translateX(0)',
		transition: 'transform 0.15s ease-in-out',
	}

	return (
		<button
			type="button"
			role="switch"
			aria-checked={checked}
			disabled={disabled}
			onClick={() => !disabled && onChange(!checked)}
			style={trackStyle}
		>
			<div style={thumbStyle} />
		</button>
	)
}

// Icons
function BellOffIcon({ size = 24 }: { size?: number }) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			style={{ flexShrink: 0 }}
		>
			<path d="M13.73 21a2 2 0 0 1-3.46 0" />
			<path d="M18.63 13A17.89 17.89 0 0 1 18 8" />
			<path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14" />
			<path d="M18 8a6 6 0 0 0-9.33-5" />
			<line x1="1" y1="1" x2="23" y2="23" />
		</svg>
	)
}
