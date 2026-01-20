/**
 * Subscriber Preferences Component
 *
 * Allow users to manage their newsletter subscription preferences.
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
import { useNewsletter } from '../newsletter-hooks'

export interface PreferenceOption {
	id: string
	label: string
	description?: string
	category?: string
}

export interface SubscriberPreferencesProps {
	/** Theme variables */
	theme?: ThemeVariables
	/** Email address (required for preference lookup) */
	email: string
	/** Called on successful update */
	onSuccess?: (preferences: string[]) => void
	/** Called on error */
	onError?: (error: string) => void
	/** Custom class name */
	className?: string
	/** Component title */
	title?: string
	/** Component description */
	description?: string
	/** Available preference options */
	options: PreferenceOption[]
	/** Show category groups */
	showCategories?: boolean
	/** Show unsubscribe all option */
	showUnsubscribeAll?: boolean
	/** Save button text */
	saveButtonText?: string
	/** Unsubscribe button text */
	unsubscribeButtonText?: string
}

/**
 * Newsletter preference management
 *
 * @example
 * ```tsx
 * <SubscriberPreferences
 *   email="user@example.com"
 *   title="Email Preferences"
 *   options={[
 *     { id: 'product', label: 'Product Updates', category: 'Updates' },
 *     { id: 'blog', label: 'Blog Posts', category: 'Content' },
 *     { id: 'promo', label: 'Promotions', category: 'Marketing' },
 *   ]}
 * />
 * ```
 */
export function SubscriberPreferences({
	theme = defaultTheme,
	email,
	onSuccess,
	onError,
	className,
	title = 'Email Preferences',
	description = "Choose which emails you'd like to receive",
	options,
	showCategories = false,
	showUnsubscribeAll = true,
	saveButtonText = 'Save Preferences',
	unsubscribeButtonText = 'Unsubscribe from All',
}: SubscriberPreferencesProps) {
	const {
		getPreferences,
		updatePreferences,
	} = useNewsletter()

	const styles = baseStyles(theme)
	const [selectedPreferences, setSelectedPreferences] = useState<string[]>([])
	const [fetchLoading, setFetchLoading] = useState(true)
	const [saving, setSaving] = useState(false)
	const [unsubscribing, setUnsubscribing] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [success, setSuccess] = useState<string | null>(null)

	// Inject global styles
	useEffect(() => {
		injectGlobalStyles()
	}, [])

	// Fetch subscriber preferences on mount
	useEffect(() => {
		const fetchPrefs = async () => {
			try {
				const prefs = await getPreferences(email)
				// Convert Record<string, boolean> to string[]
				const selectedPrefs = Object.entries(prefs)
					.filter(([, enabled]) => enabled)
					.map(([key]) => key)
				setSelectedPreferences(selectedPrefs)
			} catch (err) {
				// Subscriber might not exist yet
				console.warn('Could not fetch subscriber preferences:', err)
			} finally {
				setFetchLoading(false)
			}
		}
		fetchPrefs()
	}, [email, getPreferences])

	const togglePreference = (id: string) => {
		setSelectedPreferences((prev) =>
			prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
		)
		setSuccess(null)
		setError(null)
	}

	const handleSave = async () => {
		setSaving(true)
		setError(null)
		setSuccess(null)

		try {
			// Convert string[] to Record<string, boolean>
			const prefsRecord = options.reduce((acc, opt) => {
				acc[opt.id] = selectedPreferences.includes(opt.id)
				return acc
			}, {} as Record<string, boolean>)

			await updatePreferences(email, prefsRecord)
			setSuccess('Preferences updated successfully')
			onSuccess?.(selectedPreferences)
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to update preferences'
			setError(message)
			onError?.(message)
		} finally {
			setSaving(false)
		}
	}

	const handleUnsubscribeAll = async () => {
		if (!confirm('Are you sure you want to unsubscribe from all emails?')) {
			return
		}

		setUnsubscribing(true)
		setError(null)
		setSuccess(null)

		try {
			// Disable all preferences by setting them to false
			const prefsRecord = options.reduce((acc, opt) => {
				acc[opt.id] = false
				return acc
			}, {} as Record<string, boolean>)
			await updatePreferences(email, prefsRecord)
			setSelectedPreferences([])
			setSuccess('You have been unsubscribed from all emails')
			onSuccess?.([])
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to unsubscribe'
			setError(message)
			onError?.(message)
		} finally {
			setUnsubscribing(false)
		}
	}

	// Group options by category if enabled
	const groupedOptions = showCategories
		? options.reduce(
				(groups, option) => {
					const category = option.category || 'General'
					if (!groups[category]) groups[category] = []
					groups[category].push(option)
					return groups
				},
				{} as Record<string, PreferenceOption[]>
			)
		: { '': options }

	const loading = fetchLoading || saving || unsubscribing

	return (
		<div className={className} style={mergeStyles(styles.card, { padding: '1.5rem' })}>
			{title && <h3 style={styles.cardTitle}>{title}</h3>}
			{description && <p style={styles.cardDescription}>{description}</p>}

			{fetchLoading ? (
				<div style={{ textAlign: 'center', padding: '2rem' }}>
					<span style={styles.spinner} />
					<p style={mergeStyles(styles.textSm, styles.textMuted, { marginTop: '1rem' })}>
						Loading preferences...
					</p>
				</div>
			) : (
				<>
					<div style={{ marginTop: '1.5rem' }}>
						{Object.entries(groupedOptions).map(([category, categoryOptions]) => (
							<div key={category} style={{ marginBottom: '1.5rem' }}>
								{showCategories && category && (
									<h4 style={mergeStyles(styles.label, { marginBottom: '0.75rem' })}>
										{category}
									</h4>
								)}
								{categoryOptions.map((option) => (
									<label
										key={option.id}
										style={{
											display: 'flex',
											alignItems: 'flex-start',
											gap: '0.75rem',
											padding: '0.75rem',
											borderRadius: theme.borderRadius,
											backgroundColor: selectedPreferences.includes(option.id)
												? `${theme.colorPrimary}10`
												: 'transparent',
											border: `1px solid ${selectedPreferences.includes(option.id) ? theme.colorPrimary : theme.colorBorder}`,
											marginBottom: '0.5rem',
											cursor: loading ? 'not-allowed' : 'pointer',
											transition: 'all 0.2s ease',
										}}
									>
										<input
											type="checkbox"
											checked={selectedPreferences.includes(option.id)}
											onChange={() => togglePreference(option.id)}
											disabled={loading}
											style={{ marginTop: '0.25rem' }}
										/>
										<div style={{ flex: 1 }}>
											<span style={{ fontSize: theme.fontSizeBase }}>{option.label}</span>
											{option.description && (
												<p style={mergeStyles(styles.textSm, styles.textMuted, { marginTop: '0.25rem' })}>
													{option.description}
												</p>
											)}
										</div>
									</label>
								))}
							</div>
						))}
					</div>

					{error && (
						<div style={mergeStyles(styles.alert, styles.alertError, { marginBottom: '1rem' })}>
							{error}
						</div>
					)}

					{success && (
						<div style={mergeStyles(styles.alert, styles.alertSuccess, { marginBottom: '1rem' })}>
							{success}
						</div>
					)}

					<div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
						<button
							type="button"
							onClick={handleSave}
							disabled={loading}
							style={mergeStyles(
								styles.button,
								styles.buttonPrimary,
								{ flex: 1 },
								loading ? styles.buttonDisabled : {}
							)}
						>
							{saving ? <span style={styles.spinner} /> : saveButtonText}
						</button>

						{showUnsubscribeAll && (
							<button
								type="button"
								onClick={handleUnsubscribeAll}
								disabled={loading}
								style={mergeStyles(
									styles.button,
									styles.buttonDestructive,
									loading ? styles.buttonDisabled : {}
								)}
							>
								{unsubscribing ? <span style={styles.spinner} /> : unsubscribeButtonText}
							</button>
						)}
					</div>
				</>
			)}
		</div>
	)
}
