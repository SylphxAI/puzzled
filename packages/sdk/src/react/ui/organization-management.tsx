/**
 * Organization Management Components
 *
 * OrganizationProfile, CreateOrganization, OrganizationList
 */

'use client'

import { useState, useEffect, type CSSProperties, type FormEvent } from 'react'
import type { ThemeVariables } from './styles'
import { defaultTheme, baseStyles, mergeStyles, injectGlobalStyles } from './styles'
import { useOrganization, RequireSdk, type Organization, type OrganizationMember, type OrgRole } from '../hooks'

// ============================================
// OrganizationProfile
// ============================================

export interface OrganizationProfileProps {
	/** Theme variables */
	theme?: ThemeVariables
	/** Custom class name */
	className?: string
	/** Organization to display (uses hook if not provided) */
	organization?: Organization
	/** Whether user can edit */
	canEdit?: boolean
	/** Called when save is clicked */
	onSave?: (data: { name: string; slug?: string; logoUrl?: string }) => Promise<void>
	/** Called when delete is clicked */
	onDelete?: () => Promise<void>
	/** Show danger zone */
	showDangerZone?: boolean
	/** Show members section */
	showMembers?: boolean
}

/**
 * Organization profile settings
 *
 * @example
 * ```tsx
 * <OrganizationProfile
 *   onSave={async (data) => updateOrg(data)}
 *   showDangerZone
 * />
 * ```
 */
export function OrganizationProfile(props: OrganizationProfileProps) {
	return (
		<RequireSdk services={['organization']} componentType="organization" theme={props.theme}>
			<OrganizationProfileInner {...props} />
		</RequireSdk>
	)
}

/** Inner component that safely uses platform hooks */
function OrganizationProfileInner({
	theme = defaultTheme,
	className,
	organization: propOrg,
	canEdit = true,
	onSave,
	onDelete,
	showDangerZone = true,
	showMembers = true,
}: OrganizationProfileProps) {
	const hookResult = useOrganization()
	const org = propOrg ?? hookResult.organization
	const members = hookResult.members

	const [name, setName] = useState(org?.name ?? '')
	const [slug, setSlug] = useState(org?.slug ?? '')
	const [isSaving, setIsSaving] = useState(false)
	const [isDeleting, setIsDeleting] = useState(false)
	const [saveSuccess, setSaveSuccess] = useState(false)
	const [deleteConfirm, setDeleteConfirm] = useState('')

	const styles = baseStyles(theme)

	useEffect(() => {
		injectGlobalStyles()
	}, [])

	useEffect(() => {
		if (org) {
			setName(org.name)
			setSlug(org.slug ?? '')
		}
	}, [org])

	useEffect(() => {
		if (saveSuccess) {
			const timer = setTimeout(() => setSaveSuccess(false), 3000)
			return () => clearTimeout(timer)
		}
	}, [saveSuccess])

	const handleSave = async (e: FormEvent) => {
		e.preventDefault()
		if (!onSave || !name.trim()) return

		setIsSaving(true)
		try {
			await onSave({ name: name.trim(), slug: slug.trim() || undefined })
			setSaveSuccess(true)
		} finally {
			setIsSaving(false)
		}
	}

	const handleDelete = async () => {
		if (!onDelete || deleteConfirm !== org?.name) return

		setIsDeleting(true)
		try {
			await onDelete()
		} finally {
			setIsDeleting(false)
		}
	}

	const containerStyle: CSSProperties = {
		fontFamily: theme.fontFamily,
	}

	const sectionStyle: CSSProperties = {
		marginBottom: '2rem',
		padding: '1.5rem',
		border: `1px solid ${theme.colorBorder}`,
		borderRadius: theme.borderRadius,
	}

	const inputStyle: CSSProperties = {
		width: '100%',
		padding: '0.75rem',
		border: `1px solid ${theme.colorBorder}`,
		borderRadius: theme.borderRadius,
		backgroundColor: theme.colorBackground,
		color: theme.colorForeground,
		fontSize: theme.fontSizeSm,
		fontFamily: theme.fontFamily,
	}

	if (!org) {
		return (
			<div style={containerStyle} className={className}>
				<div style={{ textAlign: 'center', padding: '3rem', color: theme.colorMutedForeground }}>
					No organization selected
				</div>
			</div>
		)
	}

	return (
		<div style={containerStyle} className={className}>
			{/* General Settings */}
			<div style={sectionStyle}>
				<h3 style={{ margin: '0 0 1.5rem', fontSize: theme.fontSizeLg, fontWeight: 600 }}>
					Organization Settings
				</h3>

				{saveSuccess && (
					<div style={mergeStyles(styles.alert, styles.alertSuccess, { marginBottom: '1rem' })}>
						Settings saved successfully
					</div>
				)}

				<form onSubmit={handleSave}>
					<div style={{ marginBottom: '1rem' }}>
						<label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: theme.fontSizeSm }}>
							Organization Name
						</label>
						<input
							type="text"
							value={name}
							onChange={(e) => setName(e.target.value)}
							disabled={!canEdit}
							style={inputStyle}
							placeholder="My Organization"
						/>
					</div>

					<div style={{ marginBottom: '1.5rem' }}>
						<label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: theme.fontSizeSm }}>
							URL Slug
						</label>
						<input
							type="text"
							value={slug}
							onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
							disabled={!canEdit}
							style={inputStyle}
							placeholder="my-organization"
						/>
						<p style={{ margin: '0.25rem 0 0', fontSize: theme.fontSizeXs, color: theme.colorMutedForeground }}>
							Used in URLs: /org/{slug || 'my-organization'}
						</p>
					</div>

					{canEdit && onSave && (
						<button
							type="submit"
							disabled={isSaving || !name.trim()}
							style={mergeStyles(styles.button, styles.buttonPrimary)}
						>
							{isSaving ? <span style={styles.spinner} /> : 'Save Changes'}
						</button>
					)}
				</form>
			</div>

			{/* Members */}
			{showMembers && members.length > 0 && (
				<div style={sectionStyle}>
					<h3 style={{ margin: '0 0 1rem', fontSize: theme.fontSizeLg, fontWeight: 600 }}>
						Members ({members.length})
					</h3>
					<div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
						{members.slice(0, 5).map((member) => (
							<div
								key={member.userId}
								style={{
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'space-between',
									padding: '0.75rem',
									backgroundColor: theme.colorMuted,
									borderRadius: theme.borderRadiusSm,
								}}
							>
								<div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
									<div
										style={{
											width: 32,
											height: 32,
											borderRadius: '50%',
											backgroundColor: theme.colorPrimary,
											color: theme.colorPrimaryForeground,
											display: 'flex',
											alignItems: 'center',
											justifyContent: 'center',
											fontWeight: 600,
											fontSize: theme.fontSizeXs,
										}}
									>
										{member.name?.charAt(0).toUpperCase() ?? member.email?.charAt(0).toUpperCase() ?? '?'}
									</div>
									<div>
										<div style={{ fontWeight: 500, fontSize: theme.fontSizeSm }}>
											{member.name ?? member.email}
										</div>
										{member.name && member.email && (
											<div style={{ fontSize: theme.fontSizeXs, color: theme.colorMutedForeground }}>
												{member.email}
											</div>
										)}
									</div>
								</div>
								<span
									style={{
										fontSize: theme.fontSizeXs,
										padding: '0.25rem 0.5rem',
										backgroundColor: member.role === 'super_admin' ? theme.colorPrimary : theme.colorBackground,
										color: member.role === 'super_admin' ? theme.colorPrimaryForeground : theme.colorForeground,
										borderRadius: theme.borderRadiusSm,
										textTransform: 'capitalize',
									}}
								>
									{member.role}
								</span>
							</div>
						))}
						{members.length > 5 && (
							<p style={{ margin: '0.5rem 0 0', fontSize: theme.fontSizeXs, color: theme.colorMutedForeground, textAlign: 'center' }}>
								+{members.length - 5} more members
							</p>
						)}
					</div>
				</div>
			)}

			{/* Danger Zone */}
			{showDangerZone && onDelete && (
				<div
					style={{
						...sectionStyle,
						borderColor: theme.colorDestructive,
						backgroundColor: `${theme.colorDestructive}08`,
					}}
				>
					<h3 style={{ margin: '0 0 0.5rem', fontSize: theme.fontSizeLg, fontWeight: 600, color: theme.colorDestructive }}>
						Danger Zone
					</h3>
					<p style={{ margin: '0 0 1rem', fontSize: theme.fontSizeSm, color: theme.colorMutedForeground }}>
						Deleting this organization will remove all data, members, and settings. This action cannot be undone.
					</p>

					<div style={{ marginBottom: '1rem' }}>
						<label style={{ display: 'block', marginBottom: '0.5rem', fontSize: theme.fontSizeSm }}>
							Type <strong>{org.name}</strong> to confirm
						</label>
						<input
							type="text"
							value={deleteConfirm}
							onChange={(e) => setDeleteConfirm(e.target.value)}
							style={inputStyle}
							placeholder={org.name}
						/>
					</div>

					<button
						type="button"
						onClick={handleDelete}
						disabled={isDeleting || deleteConfirm !== org.name}
						style={mergeStyles(styles.button, styles.buttonDestructive, {
							opacity: deleteConfirm !== org.name ? 0.5 : 1,
						})}
					>
						{isDeleting ? <span style={styles.spinner} /> : 'Delete Organization'}
					</button>
				</div>
			)}
		</div>
	)
}

// ============================================
// CreateOrganization
// ============================================

export interface CreateOrganizationProps {
	/** Theme variables */
	theme?: ThemeVariables
	/** Custom class name */
	className?: string
	/** Title */
	title?: string
	/** Description */
	description?: string
	/** Called when organization is created */
	onCreate: (data: { name: string; slug?: string }) => Promise<void>
	/** Called when cancelled */
	onCancel?: () => void
	/** Show cancel button */
	showCancel?: boolean
}

/**
 * Create organization form
 *
 * @example
 * ```tsx
 * <CreateOrganization
 *   onCreate={async (data) => {
 *     await createOrg(data)
 *     router.push(`/org/${data.slug}`)
 *   }}
 * />
 * ```
 */
export function CreateOrganization({
	theme = defaultTheme,
	className,
	title = 'Create Organization',
	description = 'Organizations let you collaborate with team members and manage shared resources.',
	onCreate,
	onCancel,
	showCancel = true,
}: CreateOrganizationProps) {
	const [name, setName] = useState('')
	const [slug, setSlug] = useState('')
	const [isCreating, setIsCreating] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const styles = baseStyles(theme)

	useEffect(() => {
		injectGlobalStyles()
	}, [])

	// Auto-generate slug from name
	useEffect(() => {
		if (name && !slug) {
			const generatedSlug = name
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, '-')
				.replace(/^-|-$/g, '')
			setSlug(generatedSlug)
		}
	}, [name, slug])

	const handleSubmit = async (e: FormEvent) => {
		e.preventDefault()
		if (!name.trim()) return

		setIsCreating(true)
		setError(null)

		try {
			await onCreate({ name: name.trim(), slug: slug.trim() || undefined })
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to create organization')
		} finally {
			setIsCreating(false)
		}
	}

	const containerStyle: CSSProperties = {
		fontFamily: theme.fontFamily,
		maxWidth: '400px',
		margin: '0 auto',
	}

	const inputStyle: CSSProperties = {
		width: '100%',
		padding: '0.75rem',
		border: `1px solid ${theme.colorBorder}`,
		borderRadius: theme.borderRadius,
		backgroundColor: theme.colorBackground,
		color: theme.colorForeground,
		fontSize: theme.fontSizeSm,
		fontFamily: theme.fontFamily,
	}

	return (
		<div style={containerStyle} className={className}>
			<div style={{ textAlign: 'center', marginBottom: '2rem' }}>
				<OrgIcon color={theme.colorPrimary} size={48} />
				<h2 style={{ margin: '1rem 0 0.5rem', fontSize: theme.fontSizeXl, fontWeight: 600 }}>
					{title}
				</h2>
				<p style={{ margin: 0, color: theme.colorMutedForeground, fontSize: theme.fontSizeSm }}>
					{description}
				</p>
			</div>

			{error && (
				<div style={mergeStyles(styles.alert, styles.alertError, { marginBottom: '1rem' })}>
					{error}
				</div>
			)}

			<form onSubmit={handleSubmit}>
				<div style={{ marginBottom: '1rem' }}>
					<label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: theme.fontSizeSm }}>
						Organization Name *
					</label>
					<input
						type="text"
						value={name}
						onChange={(e) => setName(e.target.value)}
						style={inputStyle}
						placeholder="Acme Inc."
						required
					/>
				</div>

				<div style={{ marginBottom: '1.5rem' }}>
					<label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: theme.fontSizeSm }}>
						URL Slug
					</label>
					<input
						type="text"
						value={slug}
						onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
						style={inputStyle}
						placeholder="acme-inc"
					/>
					<p style={{ margin: '0.25rem 0 0', fontSize: theme.fontSizeXs, color: theme.colorMutedForeground }}>
						Letters, numbers, and hyphens only
					</p>
				</div>

				<div style={{ display: 'flex', gap: '0.75rem' }}>
					{showCancel && onCancel && (
						<button
							type="button"
							onClick={onCancel}
							style={mergeStyles(styles.button, styles.buttonOutline, { flex: 1 })}
						>
							Cancel
						</button>
					)}
					<button
						type="submit"
						disabled={isCreating || !name.trim()}
						style={mergeStyles(styles.button, styles.buttonPrimary, { flex: 1 })}
					>
						{isCreating ? <span style={styles.spinner} /> : 'Create Organization'}
					</button>
				</div>
			</form>
		</div>
	)
}

// ============================================
// OrganizationList
// ============================================

export interface OrganizationListProps {
	/** Theme variables */
	theme?: ThemeVariables
	/** Custom class name */
	className?: string
	/** Organizations to display */
	organizations: Organization[]
	/** Currently selected organization ID */
	selectedId?: string
	/** Called when organization is selected */
	onSelect?: (org: Organization) => void
	/** Called when create is clicked */
	onCreate?: () => void
	/** Show create button */
	showCreateButton?: boolean
	/** Empty state message */
	emptyMessage?: string
}

/**
 * List of organizations
 *
 * @example
 * ```tsx
 * <OrganizationList
 *   organizations={orgs}
 *   selectedId={currentOrg.id}
 *   onSelect={(org) => switchOrg(org.id)}
 *   onCreate={() => router.push('/create-org')}
 * />
 * ```
 */
export function OrganizationList({
	theme = defaultTheme,
	className,
	organizations,
	selectedId,
	onSelect,
	onCreate,
	showCreateButton = true,
	emptyMessage = 'No organizations',
}: OrganizationListProps) {
	const styles = baseStyles(theme)

	useEffect(() => {
		injectGlobalStyles()
	}, [])

	const containerStyle: CSSProperties = {
		fontFamily: theme.fontFamily,
	}

	const itemStyle = (isSelected: boolean): CSSProperties => ({
		display: 'flex',
		alignItems: 'center',
		gap: '0.75rem',
		padding: '0.75rem 1rem',
		border: `1px solid ${isSelected ? theme.colorPrimary : theme.colorBorder}`,
		borderRadius: theme.borderRadius,
		backgroundColor: isSelected ? `${theme.colorPrimary}10` : theme.colorBackground,
		cursor: 'pointer',
		transition: 'all 0.15s ease',
	})

	return (
		<div style={containerStyle} className={className}>
			{organizations.length === 0 ? (
				<div
					style={{
						padding: '3rem',
						textAlign: 'center',
						color: theme.colorMutedForeground,
						border: `1px solid ${theme.colorBorder}`,
						borderRadius: theme.borderRadius,
					}}
				>
					<OrgIcon color={theme.colorMuted} size={48} />
					<p style={{ margin: '1rem 0' }}>{emptyMessage}</p>
					{showCreateButton && onCreate && (
						<button
							type="button"
							onClick={onCreate}
							style={mergeStyles(styles.button, styles.buttonPrimary)}
						>
							Create Organization
						</button>
					)}
				</div>
			) : (
				<>
					<div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
						{organizations.map((org) => (
							<div
								key={org.id}
								onClick={() => onSelect?.(org)}
								style={itemStyle(org.id === selectedId)}
								role="button"
								tabIndex={0}
								onKeyDown={(e) => {
									if (e.key === 'Enter' || e.key === ' ') {
										onSelect?.(org)
									}
								}}
							>
								<div
									style={{
										width: 40,
										height: 40,
										borderRadius: theme.borderRadiusSm,
										backgroundColor: theme.colorPrimary,
										color: theme.colorPrimaryForeground,
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'center',
										fontWeight: 600,
										fontSize: theme.fontSizeLg,
									}}
								>
									{org.name.charAt(0).toUpperCase()}
								</div>
								<div style={{ flex: 1, minWidth: 0 }}>
									<div style={{ fontWeight: 500, fontSize: theme.fontSizeSm }}>{org.name}</div>
									{org.slug && (
										<div style={{ fontSize: theme.fontSizeXs, color: theme.colorMutedForeground }}>
											/{org.slug}
										</div>
									)}
								</div>
								{org.id === selectedId && (
									<CheckIcon color={theme.colorPrimary} />
								)}
							</div>
						))}
					</div>

					{showCreateButton && onCreate && (
						<button
							type="button"
							onClick={onCreate}
							style={mergeStyles(styles.button, styles.buttonOutline, {
								width: '100%',
								marginTop: '1rem',
							})}
						>
							<PlusIcon color={theme.colorForeground} /> Create Organization
						</button>
					)}
				</>
			)}
		</div>
	)
}

// ============================================
// Icons
// ============================================

function OrgIcon({ color, size = 24 }: { color: string; size?: number }) {
	return (
		<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
			<circle cx="9" cy="7" r="4" />
			<path d="M23 21v-2a4 4 0 0 0-3-3.87" />
			<path d="M16 3.13a4 4 0 0 1 0 7.75" />
		</svg>
	)
}

function CheckIcon({ color }: { color: string }) {
	return (
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<polyline points="20 6 9 17 4 12" />
		</svg>
	)
}

function PlusIcon({ color }: { color: string }) {
	return (
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '0.25rem' }}>
			<line x1="12" y1="5" x2="12" y2="19" />
			<line x1="5" y1="12" x2="19" y2="12" />
		</svg>
	)
}
