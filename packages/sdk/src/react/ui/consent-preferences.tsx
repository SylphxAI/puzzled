/**
 * Consent Preferences Component
 *
 * Full consent preference management panel/modal.
 * Can be embedded in settings pages or triggered from footer link.
 */

'use client'

import { useState, useEffect, type CSSProperties } from 'react'
import type { ThemeVariables } from './styles'
import {
	defaultTheme,
	baseStyles,
	mergeStyles,
	injectGlobalStyles,
} from './styles'
import { useConsent, type ConsentCategory, type ConsentType } from '../consent-hooks'
import { Modal } from './modal'

export interface ConsentPreferencesProps {
	/** Theme variables */
	theme?: ThemeVariables
	/** Display as modal or embedded panel */
	mode?: 'modal' | 'embedded'
	/** Whether modal is open (only for modal mode) */
	open?: boolean
	/** Called when modal is closed */
	onClose?: () => void
	/** Called when preferences are saved */
	onSave?: () => void
	/** Title */
	title?: string
	/** Description */
	description?: string
	/** Privacy policy URL */
	privacyPolicyUrl?: string
	/** Custom class name */
	className?: string
	/** Show category descriptions */
	showDescriptions?: boolean
	/** Group by category */
	groupByCategory?: boolean
}

// Category info
const CATEGORY_INFO: Record<ConsentCategory, { name: string; description: string; icon: string }> = {
	necessary: {
		name: 'Necessary',
		description: 'Essential for the website to function properly. Cannot be disabled.',
		icon: '🔒',
	},
	functional: {
		name: 'Functional',
		description: 'Enable enhanced functionality and personalization.',
		icon: '⚙️',
	},
	preferences: {
		name: 'Preferences',
		description: 'Remember your settings and preferences for a better experience.',
		icon: '🎛️',
	},
	analytics: {
		name: 'Analytics',
		description: 'Help us understand how visitors interact with our website.',
		icon: '📊',
	},
	marketing: {
		name: 'Marketing',
		description: 'Used to deliver personalized advertisements.',
		icon: '📢',
	},
}

/**
 * Consent preferences panel
 *
 * @example
 * ```tsx
 * // Embedded in settings page
 * <ConsentPreferences mode="embedded" />
 *
 * // As a modal
 * const [open, setOpen] = useState(false)
 * <button onClick={() => setOpen(true)}>Cookie Settings</button>
 * <ConsentPreferences
 *   mode="modal"
 *   open={open}
 *   onClose={() => setOpen(false)}
 * />
 * ```
 */
export function ConsentPreferences({
	theme = defaultTheme,
	mode = 'embedded',
	open = false,
	onClose,
	onSave,
	title = 'Privacy Preferences',
	description = 'Manage your cookie and privacy preferences. You can change these settings at any time.',
	privacyPolicyUrl,
	className,
	showDescriptions = true,
	groupByCategory = true,
}: ConsentPreferencesProps) {
	const {
		types,
		consents,
		setConsent,
		setConsents,
		acceptAll,
		declineOptional,
		saveConsents,
		isLoading,
		hasConsented,
	} = useConsent()

	const [isSaving, setIsSaving] = useState(false)
	const [saveSuccess, setSaveSuccess] = useState(false)
	const styles = baseStyles(theme)

	// Inject global styles
	useEffect(() => {
		injectGlobalStyles()
	}, [])

	// Clear success message
	useEffect(() => {
		if (saveSuccess) {
			const timer = setTimeout(() => setSaveSuccess(false), 3000)
			return () => clearTimeout(timer)
		}
	}, [saveSuccess])

	// Handle save
	const handleSave = async () => {
		setIsSaving(true)
		try {
			await saveConsents()
			setSaveSuccess(true)
			onSave?.()
			if (mode === 'modal') {
				onClose?.()
			}
		} finally {
			setIsSaving(false)
		}
	}

	// Handle accept all
	const handleAcceptAll = async () => {
		setIsSaving(true)
		try {
			await acceptAll()
			setSaveSuccess(true)
			onSave?.()
			if (mode === 'modal') {
				onClose?.()
			}
		} finally {
			setIsSaving(false)
		}
	}

	// Handle decline optional
	const handleDeclineOptional = async () => {
		setIsSaving(true)
		try {
			await declineOptional()
			setSaveSuccess(true)
			onSave?.()
			if (mode === 'modal') {
				onClose?.()
			}
		} finally {
			setIsSaving(false)
		}
	}

	// Group types by category
	const typesByCategory: Record<string, ConsentType[]> = groupByCategory
		? types.reduce<Record<string, ConsentType[]>>((acc, type) => {
				const category = type.category || 'functional'
				if (!acc[category]) acc[category] = []
				acc[category].push(type)
				return acc
			}, {})
		: { all: types }

	const content = (
		<div style={{ fontFamily: theme.fontFamily }}>
			{/* Header */}
			<div style={{ marginBottom: '1.5rem' }}>
				<h2 style={{ margin: 0, fontSize: theme.fontSizeXl, fontWeight: 600, marginBottom: '0.5rem' }}>
					{title}
				</h2>
				<p style={mergeStyles(styles.textSm, styles.textMuted, { margin: 0 })}>
					{description}
					{privacyPolicyUrl && (
						<>
							{' '}
							<a href={privacyPolicyUrl} style={styles.link} target="_blank" rel="noopener noreferrer">
								Learn more
							</a>
						</>
					)}
				</p>
			</div>

			{/* Success message */}
			{saveSuccess && (
				<div style={mergeStyles(styles.alert, styles.alertSuccess)}>
					<CheckIcon color={theme.colorSuccess} /> Preferences saved successfully
				</div>
			)}

			{/* Quick actions */}
			<div style={mergeStyles(styles.flexRow, { gap: '0.75rem', marginBottom: '1.5rem' })}>
				<button
					type="button"
					onClick={handleAcceptAll}
					disabled={isSaving}
					style={mergeStyles(styles.button, styles.buttonPrimary)}
				>
					Accept All
				</button>
				<button
					type="button"
					onClick={handleDeclineOptional}
					disabled={isSaving}
					style={mergeStyles(styles.button, styles.buttonOutline)}
				>
					Necessary Only
				</button>
			</div>

			{/* Categories */}
			<div style={{ marginBottom: '1.5rem' }}>
				{Object.entries(typesByCategory).map(([category, categoryTypes]) => {
					const info = CATEGORY_INFO[category as ConsentCategory]
					const isNecessary = category === 'necessary'

					// Count enabled in this category
					const enabledCount = categoryTypes.filter(t => consents[t.slug] ?? t.defaultEnabled).length

					return (
						<div
							key={category}
							style={{
								marginBottom: '1rem',
								border: `1px solid ${theme.colorBorder}`,
								borderRadius: theme.borderRadius,
								overflow: 'hidden',
							}}
						>
							{/* Category header */}
							{groupByCategory && info && (
								<div
									style={{
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'space-between',
										padding: '1rem',
										backgroundColor: theme.colorMuted,
										borderBottom: `1px solid ${theme.colorBorder}`,
									}}
								>
									<div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
										<span style={{ fontSize: '1.25rem' }}>{info.icon}</span>
										<div>
											<div style={{ fontWeight: 600, fontSize: theme.fontSizeSm }}>{info.name}</div>
											{showDescriptions && (
												<div style={{ fontSize: theme.fontSizeXs, color: theme.colorMutedForeground }}>
													{info.description}
												</div>
											)}
										</div>
									</div>
									<div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
										<span style={{ fontSize: theme.fontSizeXs, color: theme.colorMutedForeground }}>
											{enabledCount}/{categoryTypes.length} enabled
										</span>
										{!isNecessary && (
											<CategoryToggle
												enabled={enabledCount === categoryTypes.length}
												onChange={(enabled) => {
													const updates: Record<string, boolean> = {}
													categoryTypes.forEach(t => {
														if (!t.required) updates[t.slug] = enabled
													})
													setConsents(updates)
												}}
												theme={theme}
											/>
										)}
									</div>
								</div>
							)}

							{/* Individual consent types */}
							<div style={{ padding: '0.5rem 0' }}>
								{categoryTypes.map((type, index) => (
									<div
										key={type.id}
										style={{
											display: 'flex',
											alignItems: 'center',
											justifyContent: 'space-between',
											padding: '0.75rem 1rem',
											borderBottom: index < categoryTypes.length - 1 ? `1px solid ${theme.colorBorder}` : 'none',
										}}
									>
										<div style={{ flex: 1, minWidth: 0 }}>
											<div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
												<span style={{ fontWeight: 500, fontSize: theme.fontSizeSm }}>{type.name}</span>
												{type.required && (
													<span
														style={{
															fontSize: '0.625rem',
															color: theme.colorMutedForeground,
															backgroundColor: theme.colorMuted,
															padding: '0.125rem 0.375rem',
															borderRadius: '4px',
															textTransform: 'uppercase',
														}}
													>
														Required
													</span>
												)}
											</div>
											{showDescriptions && type.description && (
												<p style={{ margin: '0.25rem 0 0', fontSize: theme.fontSizeXs, color: theme.colorMutedForeground }}>
													{type.description}
												</p>
											)}
										</div>
										<Toggle
											checked={consents[type.slug] ?? type.defaultEnabled}
											onChange={(checked) => setConsent(type.slug, checked)}
											disabled={type.required}
											theme={theme}
										/>
									</div>
								))}
							</div>
						</div>
					)
				})}
			</div>

			{/* Save button */}
			<div style={mergeStyles(styles.flexRow, { gap: '0.75rem', justifyContent: 'flex-end' })}>
				{mode === 'modal' && (
					<button
						type="button"
						onClick={onClose}
						style={mergeStyles(styles.button, styles.buttonOutline)}
					>
						Cancel
					</button>
				)}
				<button
					type="button"
					onClick={handleSave}
					disabled={isSaving}
					style={mergeStyles(styles.button, styles.buttonPrimary)}
				>
					{isSaving ? <span style={styles.spinner} /> : 'Save Preferences'}
				</button>
			</div>

			{/* Last updated */}
			{hasConsented && (
				<p style={mergeStyles(styles.textXs, styles.textMuted, { marginTop: '1rem', textAlign: 'center' })}>
					You can update your preferences at any time.
				</p>
			)}
		</div>
	)

	if (mode === 'modal') {
		return (
			<Modal open={open} onClose={onClose ?? (() => {})} theme={theme}>
				<div style={{ padding: '1.5rem', maxWidth: '600px' }} className={className}>
					{content}
				</div>
			</Modal>
		)
	}

	return (
		<div
			style={mergeStyles(styles.card, { padding: '1.5rem' })}
			className={className}
		>
			{content}
		</div>
	)
}

// Toggle component
interface ToggleProps {
	checked: boolean
	onChange: (checked: boolean) => void
	disabled?: boolean
	theme: ThemeVariables
}

function Toggle({ checked, onChange, disabled, theme }: ToggleProps) {
	const style: CSSProperties = {
		position: 'relative',
		width: '40px',
		height: '22px',
		backgroundColor: checked ? theme.colorPrimary : theme.colorMuted,
		borderRadius: '11px',
		cursor: disabled ? 'not-allowed' : 'pointer',
		transition: 'background-color 0.2s ease',
		opacity: disabled ? 0.6 : 1,
		border: 'none',
		padding: 0,
		flexShrink: 0,
	}

	const knobStyle: CSSProperties = {
		position: 'absolute',
		top: '2px',
		left: checked ? '20px' : '2px',
		width: '18px',
		height: '18px',
		backgroundColor: '#fff',
		borderRadius: '50%',
		boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
		transition: 'left 0.2s ease',
	}

	return (
		<button
			type="button"
			role="switch"
			aria-checked={checked}
			disabled={disabled}
			onClick={() => !disabled && onChange(!checked)}
			style={style}
		>
			<span style={knobStyle} />
		</button>
	)
}

// Category toggle (larger)
function CategoryToggle({
	enabled,
	onChange,
	theme,
}: {
	enabled: boolean
	onChange: (enabled: boolean) => void
	theme: ThemeVariables
}) {
	return (
		<button
			type="button"
			onClick={() => onChange(!enabled)}
			style={{
				padding: '0.25rem 0.5rem',
				fontSize: theme.fontSizeXs,
				fontWeight: 500,
				backgroundColor: enabled ? theme.colorPrimary : 'transparent',
				color: enabled ? theme.colorPrimaryForeground : theme.colorMutedForeground,
				border: `1px solid ${enabled ? theme.colorPrimary : theme.colorBorder}`,
				borderRadius: theme.borderRadiusSm,
				cursor: 'pointer',
				transition: 'all 0.15s ease',
			}}
		>
			{enabled ? 'All On' : 'All Off'}
		</button>
	)
}

// Check icon
function CheckIcon({ color }: { color: string }) {
	return (
		<svg
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke={color}
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			style={{ marginRight: '0.5rem' }}
		>
			<polyline points="20 6 9 17 4 12" />
		</svg>
	)
}
