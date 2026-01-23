/**
 * OrganizationSwitcher Component
 *
 * Dropdown to switch between organizations.
 * Matches Clerk's OrganizationSwitcher component API.
 */

'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useOrganization, useUser, RequireSdk } from '../hooks'
import { safeRedirect } from '../security-utils'
import {
	type ThemeVariables,
	defaultTheme,
	baseStyles,
	mergeStyles,
	injectGlobalStyles,
} from '../ui/styles'

export interface OrganizationSwitcherProps {
	/** Theme variables */
	theme?: ThemeVariables
	/** Show personal workspace option */
	hidePersonal?: boolean
	/** Called when organization is switched */
	onOrganizationSwitch?: (orgId: string | null) => void
	/** URL to navigate to after creating an org */
	afterCreateOrganizationUrl?: string
	/** URL to navigate to for organization settings */
	organizationSettingsUrl?: string
	/** Custom class name */
	className?: string
	/** Trigger button appearance */
	appearance?: {
		baseStyle?: React.CSSProperties
	}
}

/**
 * Organization switcher dropdown
 *
 * @example
 * ```tsx
 * <OrganizationSwitcher
 *   onOrganizationSwitch={(orgId) => console.log('Switched to', orgId)}
 *   afterCreateOrganizationUrl="/org/settings"
 * />
 * ```
 */
export function OrganizationSwitcher(props: OrganizationSwitcherProps) {
	return (
		<RequireSdk services={['organization']} componentType="organization" theme={props.theme}>
			<OrganizationSwitcherInner {...props} />
		</RequireSdk>
	)
}

/** Inner component that safely uses platform hooks */
function OrganizationSwitcherInner({
	theme = defaultTheme,
	hidePersonal = false,
	onOrganizationSwitch,
	afterCreateOrganizationUrl = '/org/settings',
	organizationSettingsUrl,
	className,
	appearance,
}: OrganizationSwitcherProps) {
	const { user, isLoaded: userLoaded } = useUser()
	const {
		organization,
		organizations,
		isLoading,
		setOrganization,
		createOrganization,
	} = useOrganization()
	const styles = baseStyles(theme)

	const [isOpen, setIsOpen] = useState(false)
	const [isCreating, setIsCreating] = useState(false)
	const [newOrgName, setNewOrgName] = useState('')
	const [error, setError] = useState<string | null>(null)
	const dropdownRef = useRef<HTMLDivElement>(null)

	// Inject global styles
	useEffect(() => {
		injectGlobalStyles()
	}, [])

	// Close dropdown when clicking outside
	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
				setIsOpen(false)
				setIsCreating(false)
			}
		}

		document.addEventListener('mousedown', handleClickOutside)
		return () => document.removeEventListener('mousedown', handleClickOutside)
	}, [])

	const handleSwitch = useCallback(
		(orgId: string | null) => {
			setOrganization(orgId)
			onOrganizationSwitch?.(orgId)
			setIsOpen(false)
		},
		[setOrganization, onOrganizationSwitch]
	)

	const handleCreate = useCallback(async () => {
		if (!newOrgName.trim()) return

		setError(null)
		try {
			const slug = newOrgName.toLowerCase().replace(/[^a-z0-9]+/g, '-')
			const newOrg = await createOrganization({ name: newOrgName, slug })
			setNewOrgName('')
			setIsCreating(false)
			setIsOpen(false)
			onOrganizationSwitch?.(newOrg.id)

			if (afterCreateOrganizationUrl && typeof window !== 'undefined') {
				safeRedirect(afterCreateOrganizationUrl, { fallback: '/dashboard' })
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to create organization'
			setError(message)
		}
	}, [newOrgName, createOrganization, onOrganizationSwitch, afterCreateOrganizationUrl])

	if (!userLoaded || isLoading) {
		return (
			<div
				style={mergeStyles(styles.button, styles.buttonOutline, {
					width: '180px',
					justifyContent: 'flex-start',
					opacity: 0.5,
				})}
			>
				<span style={styles.spinner} />
				Loading...
			</div>
		)
	}

	if (!user) {
		return null
	}

	const currentDisplay = organization?.name || 'Personal'

	const triggerStyles: React.CSSProperties = {
		display: 'flex',
		alignItems: 'center',
		gap: '0.5rem',
		padding: '0.5rem 0.75rem',
		fontSize: theme.fontSizeSm,
		fontWeight: 500,
		borderRadius: theme.borderRadius,
		border: `1px solid ${theme.colorBorder}`,
		backgroundColor: theme.colorBackground,
		color: theme.colorForeground,
		cursor: 'pointer',
		minWidth: '160px',
		justifyContent: 'space-between',
		...appearance?.baseStyle,
	}

	const dropdownStyles: React.CSSProperties = {
		position: 'absolute',
		top: '100%',
		left: 0,
		marginTop: '0.25rem',
		minWidth: '220px',
		backgroundColor: theme.colorBackground,
		border: `1px solid ${theme.colorBorder}`,
		borderRadius: theme.borderRadius,
		boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
		zIndex: 50,
		overflow: 'hidden',
	}

	const itemStyles: React.CSSProperties = {
		display: 'flex',
		alignItems: 'center',
		gap: '0.75rem',
		padding: '0.625rem 0.75rem',
		fontSize: theme.fontSizeSm,
		color: theme.colorForeground,
		cursor: 'pointer',
		backgroundColor: 'transparent',
		border: 'none',
		width: '100%',
		textAlign: 'left',
		transition: 'background-color 0.15s',
	}

	const itemHoverStyles: React.CSSProperties = {
		backgroundColor: theme.colorMuted,
	}

	const avatarStyles: React.CSSProperties = {
		width: '1.75rem',
		height: '1.75rem',
		borderRadius: '4px',
		backgroundColor: theme.colorPrimary,
		color: '#fff',
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		fontSize: '0.75rem',
		fontWeight: 600,
	}

	const personalAvatarStyles: React.CSSProperties = {
		...avatarStyles,
		borderRadius: '50%',
	}

	return (
		<div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
			{/* Trigger */}
			<button
				type="button"
				onClick={() => setIsOpen(!isOpen)}
				className={className}
				style={triggerStyles}
			>
				<span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
					{organization ? (
						<span style={avatarStyles}>
							{organization.logoUrl ? (
								<img
									src={organization.logoUrl}
									alt={organization.name}
									style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px' }}
								/>
							) : (
								organization.name.charAt(0).toUpperCase()
							)}
						</span>
					) : (
						<span style={personalAvatarStyles}>
							{user.image ? (
								<img
									src={user.image}
									alt={user.name || 'User'}
									style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
								/>
							) : (
								(user.name || user.email).charAt(0).toUpperCase()
							)}
						</span>
					)}
					<span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
						{currentDisplay}
					</span>
				</span>
				<ChevronIcon />
			</button>

			{/* Dropdown */}
			{isOpen && (
				<div style={dropdownStyles}>
					{/* Personal workspace */}
					{!hidePersonal && (
						<button
							type="button"
							onClick={() => handleSwitch(null)}
							style={itemStyles}
							onMouseEnter={(e) => Object.assign(e.currentTarget.style, itemHoverStyles)}
							onMouseLeave={(e) => Object.assign(e.currentTarget.style, { backgroundColor: 'transparent' })}
						>
							<span style={personalAvatarStyles}>
								{user.image ? (
									<img
										src={user.image}
										alt={user.name || 'User'}
										style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
									/>
								) : (
									(user.name || user.email).charAt(0).toUpperCase()
								)}
							</span>
							<span style={{ flex: 1 }}>Personal</span>
							{!organization && <CheckIcon color={theme.colorPrimary} size={16} />}
						</button>
					)}

					{/* Organizations */}
					{organizations.length > 0 && (
						<>
							<div
								style={{
									borderTop: `1px solid ${theme.colorBorder}`,
									margin: '0.25rem 0',
								}}
							/>
							<div
								style={{
									padding: '0.375rem 0.75rem',
									fontSize: theme.fontSizeXs,
									color: theme.colorMutedForeground,
									textTransform: 'uppercase',
									letterSpacing: '0.05em',
								}}
							>
								Organizations
							</div>
							{organizations.map((org) => (
								<button
									key={org.id}
									type="button"
									onClick={() => handleSwitch(org.id)}
									style={itemStyles}
									onMouseEnter={(e) => Object.assign(e.currentTarget.style, itemHoverStyles)}
									onMouseLeave={(e) => Object.assign(e.currentTarget.style, { backgroundColor: 'transparent' })}
								>
									<span style={avatarStyles}>
										{org.logoUrl ? (
											<img
												src={org.logoUrl}
												alt={org.name}
												style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px' }}
											/>
										) : (
											org.name.charAt(0).toUpperCase()
										)}
									</span>
									<span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
										{org.name}
									</span>
									{organization?.id === org.id && <CheckIcon color={theme.colorPrimary} size={16} />}
								</button>
							))}
						</>
					)}

					{/* Create organization */}
					<div style={{ borderTop: `1px solid ${theme.colorBorder}`, margin: '0.25rem 0' }} />
					{isCreating ? (
						<div style={{ padding: '0.75rem' }}>
							<input
								type="text"
								value={newOrgName}
								onChange={(e) => setNewOrgName(e.target.value)}
								placeholder="Organization name"
								autoFocus
								style={mergeStyles(styles.input, { fontSize: theme.fontSizeSm })}
								onKeyDown={(e) => {
									if (e.key === 'Enter') handleCreate()
									if (e.key === 'Escape') setIsCreating(false)
								}}
							/>
							{error && (
								<p style={mergeStyles(styles.textXs, { color: theme.colorDestructive, marginTop: '0.25rem' })}>
									{error}
								</p>
							)}
							<div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
								<button
									type="button"
									onClick={handleCreate}
									disabled={!newOrgName.trim()}
									style={mergeStyles(
										styles.button,
										styles.buttonPrimary,
										{ flex: 1, fontSize: theme.fontSizeSm, padding: '0.375rem 0.5rem' },
										!newOrgName.trim() ? styles.buttonDisabled : {}
									)}
								>
									Create
								</button>
								<button
									type="button"
									onClick={() => {
										setIsCreating(false)
										setNewOrgName('')
										setError(null)
									}}
									style={mergeStyles(styles.button, styles.buttonOutline, {
										fontSize: theme.fontSizeSm,
										padding: '0.375rem 0.5rem',
									})}
								>
									Cancel
								</button>
							</div>
						</div>
					) : (
						<button
							type="button"
							onClick={() => setIsCreating(true)}
							style={itemStyles}
							onMouseEnter={(e) => Object.assign(e.currentTarget.style, itemHoverStyles)}
							onMouseLeave={(e) => Object.assign(e.currentTarget.style, { backgroundColor: 'transparent' })}
						>
							<span
								style={mergeStyles(avatarStyles, {
									backgroundColor: 'transparent',
									border: `1px dashed ${theme.colorBorder}`,
									color: theme.colorMutedForeground,
								})}
							>
								<PlusIcon />
							</span>
							<span style={{ color: theme.colorMutedForeground }}>Create organization</span>
						</button>
					)}

					{/* Org settings link */}
					{organization && organizationSettingsUrl && (
						<>
							<div style={{ borderTop: `1px solid ${theme.colorBorder}`, margin: '0.25rem 0' }} />
							<a
								href={organizationSettingsUrl}
								style={mergeStyles(itemStyles, { textDecoration: 'none' })}
								onMouseEnter={(e) => Object.assign(e.currentTarget.style, itemHoverStyles)}
								onMouseLeave={(e) => Object.assign(e.currentTarget.style, { backgroundColor: 'transparent' })}
							>
								<SettingsIcon color={theme.colorMutedForeground} />
								<span style={{ color: theme.colorMutedForeground }}>Organization settings</span>
							</a>
						</>
					)}
				</div>
			)}
		</div>
	)
}

function ChevronIcon() {
	return (
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
			<path d="m6 9 6 6 6-6" />
		</svg>
	)
}

function CheckIcon({ color, size = 24 }: { color: string; size?: number }) {
	return (
		<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
			<path d="M20 6 9 17l-5-5" />
		</svg>
	)
}

function PlusIcon() {
	return (
		<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
			<path d="M12 5v14M5 12h14" />
		</svg>
	)
}

function SettingsIcon({ color }: { color: string }) {
	return (
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
			<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
			<circle cx="12" cy="12" r="3" />
		</svg>
	)
}
