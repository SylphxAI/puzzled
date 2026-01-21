/**
 * MembersList Component
 *
 * Displays organization members with role management.
 * Uses optimistic updates for instant UI feedback with proper
 * rollback on failure.
 */

'use client'

import { useState, useCallback, useEffect } from 'react'
import { useOrganization, useUser, type OrgRole, type OrganizationMember } from '../hooks'
import {
	type ThemeVariables,
	defaultTheme,
	baseStyles,
	mergeStyles,
	injectGlobalStyles,
} from '../ui/styles'
import { useOptimisticList } from '../../lib/optimistic'

export interface MembersListProps {
	/** Theme variables */
	theme?: ThemeVariables
	/** Show invite button */
	showInviteButton?: boolean
	/** Called when invite button is clicked */
	onInviteClick?: () => void
	/** Hide role editor */
	hideRoleEditor?: boolean
	/** Custom class name */
	className?: string
	/** Maximum members to show before "show all" */
	maxVisible?: number
	/** Compact mode */
	compact?: boolean
}

const ROLE_LABELS: Record<OrgRole, string> = {
	owner: 'Owner',
	super_admin: 'Super Admin',
	admin: 'Admin',
	member: 'Member',
	billing: 'Billing',
	analytics: 'Analytics',
	developer: 'Developer',
	viewer: 'Viewer',
}

const ROLE_DESCRIPTIONS: Record<OrgRole, string> = {
	owner: 'Organization owner with full control',
	super_admin: 'Full access to everything',
	admin: 'Manage members, apps, and analytics',
	member: 'Standard member access',
	billing: 'Access billing and payments',
	analytics: 'View analytics and reports',
	developer: 'Manage apps and deployments',
	viewer: 'Read-only access to analytics',
}

const ROLE_ORDER: OrgRole[] = ['owner', 'super_admin', 'admin', 'member', 'billing', 'analytics', 'developer', 'viewer']

/**
 * MembersList component for displaying organization members
 *
 * @example
 * ```tsx
 * <MembersList
 *   showInviteButton
 *   onInviteClick={() => setShowInviteModal(true)}
 * />
 * ```
 */
export function MembersList({
	theme = defaultTheme,
	showInviteButton = true,
	onInviteClick,
	hideRoleEditor = false,
	className,
	maxVisible,
	compact = false,
}: MembersListProps) {
	const { user } = useUser()
	const { organization, members: serverMembers, isLoading, hasPermission, updateMemberRole, removeMember } =
		useOrganization()
	const styles = baseStyles(theme)

	const [editingMember, setEditingMember] = useState<string | null>(null)
	const [confirmingRemove, setConfirmingRemove] = useState<string | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [showAll, setShowAll] = useState(false)

	// Track which member is being updated for loading indicator
	const [pendingAction, setPendingAction] = useState<string | null>(null)

	const canManageMembers = hasPermission('manage_members')

	// Inject global styles
	useEffect(() => {
		injectGlobalStyles()
	}, [])

	/**
	 * Optimistic list management with proper rollback.
	 * Uses Map-based snapshots to handle concurrent mutations correctly.
	 */
	const {
		items: members,
		remove: optimisticRemove,
		update: optimisticUpdate,
		isPending,
	} = useOptimisticList(
		serverMembers,
		{
			// Remove member operation
			remove: async (memberId: string | number) => {
				const member = serverMembers.find((m) => m.id === memberId)
				if (member) {
					await removeMember(member.userId)
				}
			},
			// Update member role operation
			update: async (memberId: string | number, data: Partial<OrganizationMember>) => {
				const member = serverMembers.find((m) => m.id === memberId)
				if (member && data.role) {
					await updateMemberRole(member.userId, data.role)
				}
				// Return the updated member for the optimistic state
				return { ...member!, ...data }
			},
		},
		{
			onError: (err, operation) => {
				const message = err instanceof Error ? err.message : `Failed to ${operation} member`
				setError(message)
				setPendingAction(null)
			},
			onRollback: (_previousItems, operation) => {
				// Rollback already handled by useOptimisticList
				setPendingAction(null)
			},
		}
	)

	// Optimistic role update
	const handleRoleChange = useCallback(
		async (userId: string, newRole: OrgRole) => {
			setError(null)
			const member = members.find((m) => m.userId === userId)
			if (!member) return

			setPendingAction(userId)
			setEditingMember(null)

			try {
				await optimisticUpdate?.(member.id, { role: newRole })
			} catch {
				// Error already handled in onError callback
			} finally {
				setPendingAction(null)
			}
		},
		[members, optimisticUpdate]
	)

	// Optimistic remove
	const handleRemove = useCallback(
		async (userId: string) => {
			setError(null)
			const member = members.find((m) => m.userId === userId)
			if (!member) return

			setPendingAction(userId)
			setConfirmingRemove(null)

			try {
				await optimisticRemove?.(member.id)
			} catch {
				// Error already handled in onError callback
			} finally {
				setPendingAction(null)
			}
		},
		[members, optimisticRemove]
	)

	// Loading state for individual actions
	const actionLoading = isPending ? pendingAction : null

	if (isLoading) {
		return (
			<div style={mergeStyles(styles.flexCenter, { padding: '2rem' })}>
				<span style={mergeStyles(styles.spinner, { width: '1.5rem', height: '1.5rem' })} />
			</div>
		)
	}

	if (!organization) {
		return (
			<div style={mergeStyles(styles.textCenter, styles.textMuted, { padding: '2rem' })}>
				No organization selected
			</div>
		)
	}

	const visibleMembers =
		maxVisible && !showAll ? members.slice(0, maxVisible) : members
	const hasMore = maxVisible && members.length > maxVisible

	const avatarStyles: React.CSSProperties = {
		width: compact ? '2rem' : '2.5rem',
		height: compact ? '2rem' : '2.5rem',
		borderRadius: '50%',
		backgroundColor: theme.colorPrimary,
		color: theme.colorPrimaryForeground,
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		fontSize: compact ? theme.fontSizeSm : theme.fontSizeBase,
		fontWeight: 600,
		flexShrink: 0,
	}

	const memberItemStyles: React.CSSProperties = {
		display: 'flex',
		alignItems: 'center',
		gap: '0.75rem',
		padding: compact ? '0.5rem' : '0.75rem',
		borderBottom: `1px solid ${theme.colorBorder}`,
	}

	const roleBadgeStyles = (role: OrgRole): React.CSSProperties => ({
		display: 'inline-flex',
		alignItems: 'center',
		padding: '0.125rem 0.5rem',
		fontSize: theme.fontSizeXs,
		fontWeight: 500,
		borderRadius: '9999px',
		backgroundColor:
			role === 'super_admin'
				? `${theme.colorWarning}15`
				: role === 'admin'
					? `${theme.colorPrimary}15`
					: theme.colorMuted,
		color:
			role === 'super_admin'
				? theme.colorWarning
				: role === 'admin'
					? theme.colorPrimary
					: theme.colorMutedForeground,
	})

	return (
		<div className={className}>
			{/* Header */}
			<div
				style={mergeStyles(styles.flexBetween, {
					marginBottom: '1rem',
					padding: compact ? 0 : '0 0.75rem',
				})}
			>
				<div>
					<h3 style={mergeStyles(styles.cardTitle, { margin: 0 })}>Members</h3>
					<p style={mergeStyles(styles.textSm, styles.textMuted, { margin: '0.25rem 0 0' })}>
						{members.length} member{members.length !== 1 ? 's' : ''}
					</p>
				</div>
				{showInviteButton && canManageMembers && (
					<button
						type="button"
						onClick={onInviteClick}
						style={mergeStyles(styles.button, styles.buttonPrimary, {
							padding: '0.375rem 0.75rem',
							fontSize: theme.fontSizeSm,
						})}
					>
						<PlusIcon size={16} />
						Invite
					</button>
				)}
			</div>

			{/* Error message */}
			{error && (
				<div style={mergeStyles(styles.alert, styles.alertError, { margin: '0 0.75rem 1rem' })}>
					{error}
				</div>
			)}

			{/* Members list */}
			<div
				style={{
					border: `1px solid ${theme.colorBorder}`,
					borderRadius: theme.borderRadius,
					overflow: 'hidden',
				}}
			>
				{visibleMembers.map((member) => (
					<div key={member.id} style={memberItemStyles}>
						{/* Avatar */}
						{member.image ? (
							<img
								src={member.image}
								alt={member.name || member.email}
								style={{ ...avatarStyles, objectFit: 'cover' }}
							/>
						) : (
							<div style={avatarStyles}>
								{(member.name || member.email).charAt(0).toUpperCase()}
							</div>
						)}

						{/* Info */}
						<div style={{ flex: 1, minWidth: 0 }}>
							<div style={mergeStyles(styles.flexRow, { gap: '0.5rem', alignItems: 'center' })}>
								<span
									style={{
										fontWeight: 500,
										overflow: 'hidden',
										textOverflow: 'ellipsis',
										whiteSpace: 'nowrap',
									}}
								>
									{member.name || member.email.split('@')[0]}
								</span>
								{member.userId === user?.id && (
									<span
										style={{
											fontSize: theme.fontSizeXs,
											color: theme.colorMutedForeground,
											backgroundColor: theme.colorMuted,
											padding: '0.0625rem 0.375rem',
											borderRadius: '9999px',
										}}
									>
										You
									</span>
								)}
							</div>
							{!compact && member.name && (
								<p style={mergeStyles(styles.textSm, styles.textMuted, { margin: 0 })}>
									{member.email}
								</p>
							)}
						</div>

						{/* Role */}
						{editingMember === member.id ? (
							<RoleSelector
								currentRole={member.role}
								onSelect={(role) => handleRoleChange(member.userId, role)}
								onCancel={() => setEditingMember(null)}
								isLoading={actionLoading === member.userId}
								theme={theme}
							/>
						) : confirmingRemove === member.id ? (
							<div style={mergeStyles(styles.flexRow, { gap: '0.5rem' })}>
								<button
									type="button"
									onClick={() => handleRemove(member.userId)}
									disabled={actionLoading === member.userId}
									style={mergeStyles(styles.button, styles.buttonDestructive, {
										padding: '0.25rem 0.5rem',
										fontSize: theme.fontSizeXs,
									})}
								>
									{actionLoading === member.userId ? (
										<span style={styles.spinner} />
									) : (
										'Confirm'
									)}
								</button>
								<button
									type="button"
									onClick={() => setConfirmingRemove(null)}
									style={mergeStyles(styles.button, styles.buttonOutline, {
										padding: '0.25rem 0.5rem',
										fontSize: theme.fontSizeXs,
									})}
								>
									Cancel
								</button>
							</div>
						) : (
							<div style={mergeStyles(styles.flexRow, { gap: '0.5rem', alignItems: 'center' })}>
								<span style={roleBadgeStyles(member.role)}>{ROLE_LABELS[member.role]}</span>

								{/* Actions dropdown */}
								{canManageMembers && !hideRoleEditor && member.userId !== user?.id && (
									<MemberActions
										member={member}
										onEditRole={() => setEditingMember(member.id)}
										onRemove={() => setConfirmingRemove(member.id)}
										theme={theme}
									/>
								)}
							</div>
						)}
					</div>
				))}

				{/* Show more button */}
				{hasMore && (
					<button
						type="button"
						onClick={() => setShowAll(!showAll)}
						style={mergeStyles(styles.button, styles.buttonGhost, {
							width: '100%',
							justifyContent: 'center',
							padding: '0.75rem',
							borderRadius: 0,
							color: theme.colorPrimary,
						})}
					>
						{showAll ? 'Show less' : `Show all ${members.length} members`}
					</button>
				)}
			</div>
		</div>
	)
}

// Role selector component
function RoleSelector({
	currentRole,
	onSelect,
	onCancel,
	isLoading,
	theme,
}: {
	currentRole: OrgRole
	onSelect: (role: OrgRole) => void
	onCancel: () => void
	isLoading: boolean
	theme: ThemeVariables
}) {
	const styles = baseStyles(theme)

	return (
		<div
			style={{
				position: 'absolute',
				right: '0.5rem',
				backgroundColor: theme.colorBackground,
				border: `1px solid ${theme.colorBorder}`,
				borderRadius: theme.borderRadius,
				boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
				zIndex: 50,
				minWidth: '180px',
				overflow: 'hidden',
			}}
		>
			{ROLE_ORDER.map((role) => (
				<button
					key={role}
					type="button"
					onClick={() => onSelect(role)}
					disabled={isLoading || role === currentRole}
					style={{
						display: 'block',
						width: '100%',
						padding: '0.5rem 0.75rem',
						fontSize: theme.fontSizeSm,
						textAlign: 'left',
						backgroundColor: role === currentRole ? theme.colorMuted : 'transparent',
						border: 'none',
						cursor: role === currentRole ? 'default' : 'pointer',
					}}
				>
					<div style={{ fontWeight: 500 }}>{ROLE_LABELS[role]}</div>
					<div style={{ fontSize: theme.fontSizeXs, color: theme.colorMutedForeground }}>
						{ROLE_DESCRIPTIONS[role]}
					</div>
				</button>
			))}
			<div style={{ borderTop: `1px solid ${theme.colorBorder}`, padding: '0.5rem' }}>
				<button
					type="button"
					onClick={onCancel}
					style={mergeStyles(styles.button, styles.buttonOutline, styles.buttonFullWidth, {
						fontSize: theme.fontSizeSm,
						padding: '0.25rem 0.5rem',
					})}
				>
					Cancel
				</button>
			</div>
		</div>
	)
}

// Member actions dropdown
function MemberActions({
	member,
	onEditRole,
	onRemove,
	theme,
}: {
	member: OrganizationMember
	onEditRole: () => void
	onRemove: () => void
	theme: ThemeVariables
}) {
	const [isOpen, setIsOpen] = useState(false)

	return (
		<div style={{ position: 'relative' }}>
			<button
				type="button"
				onClick={() => setIsOpen(!isOpen)}
				style={{
					padding: '0.25rem',
					backgroundColor: 'transparent',
					border: 'none',
					cursor: 'pointer',
					borderRadius: theme.borderRadiusSm,
					color: theme.colorMutedForeground,
				}}
			>
				<MoreIcon />
			</button>

			{isOpen && (
				<>
					{/* Backdrop */}
					<div
						style={{
							position: 'fixed',
							inset: 0,
							zIndex: 40,
						}}
						onClick={() => setIsOpen(false)}
					/>

					{/* Dropdown */}
					<div
						style={{
							position: 'absolute',
							right: 0,
							top: '100%',
							marginTop: '0.25rem',
							backgroundColor: theme.colorBackground,
							border: `1px solid ${theme.colorBorder}`,
							borderRadius: theme.borderRadius,
							boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
							zIndex: 50,
							minWidth: '120px',
							overflow: 'hidden',
						}}
					>
						<button
							type="button"
							onClick={() => {
								setIsOpen(false)
								onEditRole()
							}}
							style={{
								display: 'flex',
								alignItems: 'center',
								gap: '0.5rem',
								width: '100%',
								padding: '0.5rem 0.75rem',
								fontSize: theme.fontSizeSm,
								textAlign: 'left',
								backgroundColor: 'transparent',
								border: 'none',
								cursor: 'pointer',
								color: theme.colorForeground,
							}}
						>
							<EditIcon size={14} />
							Change role
						</button>
						<button
							type="button"
							onClick={() => {
								setIsOpen(false)
								onRemove()
							}}
							style={{
								display: 'flex',
								alignItems: 'center',
								gap: '0.5rem',
								width: '100%',
								padding: '0.5rem 0.75rem',
								fontSize: theme.fontSizeSm,
								textAlign: 'left',
								backgroundColor: 'transparent',
								border: 'none',
								cursor: 'pointer',
								color: theme.colorDestructive,
							}}
						>
							<TrashIcon size={14} color={theme.colorDestructive} />
							Remove
						</button>
					</div>
				</>
			)}
		</div>
	)
}

// Icons
function PlusIcon({ size = 24 }: { size?: number }) {
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
		>
			<path d="M12 5v14M5 12h14" />
		</svg>
	)
}

function MoreIcon() {
	return (
		<svg
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<circle cx="12" cy="12" r="1" />
			<circle cx="12" cy="5" r="1" />
			<circle cx="12" cy="19" r="1" />
		</svg>
	)
}

function EditIcon({ size = 24 }: { size?: number }) {
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
		>
			<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
		</svg>
	)
}

function TrashIcon({ size = 24, color = 'currentColor' }: { size?: number; color?: string }) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke={color}
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M3 6h18" />
			<path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
			<path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
		</svg>
	)
}
