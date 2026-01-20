/**
 * InviteMember Component
 *
 * Modal/form for inviting new members to an organization.
 */

'use client'

import { useState, useCallback, useEffect, type FormEvent } from 'react'
import { useOrganization, type OrgRole } from '../hooks'
import {
	type ThemeVariables,
	defaultTheme,
	baseStyles,
	mergeStyles,
	injectGlobalStyles,
} from '../ui/styles'

export interface InviteMemberProps {
	/** Theme variables */
	theme?: ThemeVariables
	/** Called when invite is successful */
	onSuccess?: (email: string, role: OrgRole) => void
	/** Called on error */
	onError?: (error: string) => void
	/** Called when modal is closed */
	onClose?: () => void
	/** Show as modal */
	asModal?: boolean
	/** Default role for new invites */
	defaultRole?: OrgRole
	/** Custom class name */
	className?: string
	/** Show role descriptions */
	showRoleDescriptions?: boolean
}

const ROLE_OPTIONS: { value: OrgRole; label: string; description: string }[] = [
	{ value: 'viewer', label: 'Viewer', description: 'Read-only access to analytics' },
	{ value: 'developer', label: 'Developer', description: 'Manage apps and deployments' },
	{ value: 'analytics', label: 'Analytics', description: 'View analytics and reports' },
	{ value: 'billing', label: 'Billing', description: 'Access billing and payments' },
	{ value: 'admin', label: 'Admin', description: 'Manage members, apps, and analytics' },
	{ value: 'super_admin', label: 'Super Admin', description: 'Full access to everything' },
]

/**
 * InviteMember component for inviting users to an organization
 *
 * @example
 * ```tsx
 * // As modal
 * {showInviteModal && (
 *   <InviteMember
 *     asModal
 *     onClose={() => setShowInviteModal(false)}
 *     onSuccess={(email) => toast.success(`Invited ${email}`)}
 *   />
 * )}
 *
 * // As form
 * <InviteMember
 *   onSuccess={(email) => toast.success(`Invited ${email}`)}
 * />
 * ```
 */
export function InviteMember({
	theme = defaultTheme,
	onSuccess,
	onError,
	onClose,
	asModal = false,
	defaultRole = 'viewer',
	className,
	showRoleDescriptions = true,
}: InviteMemberProps) {
	const { organization, inviteMember, hasPermission } = useOrganization()
	const styles = baseStyles(theme)

	const [email, setEmail] = useState('')
	const [role, setRole] = useState<OrgRole>(defaultRole)
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [success, setSuccess] = useState(false)
	const [focusedField, setFocusedField] = useState<string | null>(null)

	const canInvite = hasPermission('manage_members')

	// Inject global styles
	useEffect(() => {
		injectGlobalStyles()
	}, [])

	// Handle escape key for modal
	useEffect(() => {
		if (!asModal) return

		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				onClose?.()
			}
		}

		document.addEventListener('keydown', handleEscape)
		return () => document.removeEventListener('keydown', handleEscape)
	}, [asModal, onClose])

	const handleSubmit = useCallback(
		async (e: FormEvent) => {
			e.preventDefault()
			if (!email.trim()) return

			setIsLoading(true)
			setError(null)

			try {
				await inviteMember(email.trim(), role)
				setSuccess(true)
				onSuccess?.(email.trim(), role)

				// Reset form after success
				setTimeout(() => {
					setEmail('')
					setRole(defaultRole)
					setSuccess(false)
					if (asModal) {
						onClose?.()
					}
				}, 1500)
			} catch (err) {
				const message = err instanceof Error ? err.message : 'Failed to send invite'
				setError(message)
				onError?.(message)
			} finally {
				setIsLoading(false)
			}
		},
		[email, role, inviteMember, onSuccess, onError, asModal, onClose, defaultRole]
	)

	if (!canInvite) {
		return (
			<div style={mergeStyles(styles.alert, styles.alertWarning)}>
				You don't have permission to invite members
			</div>
		)
	}

	if (!organization) {
		return (
			<div style={mergeStyles(styles.textCenter, styles.textMuted, { padding: '1rem' })}>
				No organization selected
			</div>
		)
	}

	const formContent = (
		<form onSubmit={handleSubmit}>
			{/* Email input */}
			<div style={styles.formGroup}>
				<label style={styles.label}>Email address</label>
				<input
					type="email"
					value={email}
					onChange={(e) => {
						setEmail(e.target.value)
						setError(null)
						setSuccess(false)
					}}
					onFocus={() => setFocusedField('email')}
					onBlur={() => setFocusedField(null)}
					placeholder="colleague@company.com"
					disabled={isLoading}
					required
					autoFocus
					style={mergeStyles(
						styles.input,
						focusedField === 'email' ? styles.inputFocus : {},
						isLoading ? styles.inputDisabled : {}
					)}
				/>
			</div>

			{/* Role selector */}
			<div style={styles.formGroup}>
				<label style={styles.label}>Role</label>
				<div
					style={{
						display: 'flex',
						flexDirection: 'column',
						gap: '0.5rem',
						border: `1px solid ${theme.colorBorder}`,
						borderRadius: theme.borderRadius,
						overflow: 'hidden',
					}}
				>
					{ROLE_OPTIONS.map((option) => (
						<label
							key={option.value}
							style={{
								display: 'flex',
								alignItems: 'flex-start',
								gap: '0.75rem',
								padding: '0.75rem',
								cursor: 'pointer',
								backgroundColor: role === option.value ? theme.colorMuted : 'transparent',
								borderBottom:
									option.value !== ROLE_OPTIONS[ROLE_OPTIONS.length - 1].value
										? `1px solid ${theme.colorBorder}`
										: 'none',
							}}
						>
							<input
								type="radio"
								name="role"
								value={option.value}
								checked={role === option.value}
								onChange={() => setRole(option.value)}
								disabled={isLoading}
								style={{
									marginTop: '0.125rem',
									accentColor: theme.colorPrimary,
								}}
							/>
							<div>
								<div style={{ fontWeight: 500, fontSize: theme.fontSizeSm }}>
									{option.label}
								</div>
								{showRoleDescriptions && (
									<div
										style={{
											fontSize: theme.fontSizeXs,
											color: theme.colorMutedForeground,
											marginTop: '0.125rem',
										}}
									>
										{option.description}
									</div>
								)}
							</div>
						</label>
					))}
				</div>
			</div>

			{/* Error message */}
			{error && <div style={mergeStyles(styles.alert, styles.alertError)}>{error}</div>}

			{/* Success message */}
			{success && (
				<div style={mergeStyles(styles.alert, styles.alertSuccess)}>
					<div style={mergeStyles(styles.flexRow, { gap: '0.5rem', alignItems: 'center' })}>
						<CheckIcon color={theme.colorSuccess} size={16} />
						Invite sent to {email}!
					</div>
				</div>
			)}

			{/* Actions */}
			<div style={mergeStyles(styles.flexRow, { gap: '0.75rem', marginTop: '1rem' })}>
				<button
					type="submit"
					disabled={isLoading || !email.trim() || success}
					style={mergeStyles(
						styles.button,
						styles.buttonPrimary,
						{ flex: 1 },
						isLoading || !email.trim() || success ? styles.buttonDisabled : {}
					)}
				>
					{isLoading ? (
						<>
							<span style={styles.spinner} />
							Sending...
						</>
					) : success ? (
						<>
							<CheckIcon color={theme.colorPrimaryForeground} size={16} />
							Sent!
						</>
					) : (
						<>
							<SendIcon size={16} />
							Send Invite
						</>
					)}
				</button>
				{asModal && onClose && (
					<button
						type="button"
						onClick={onClose}
						style={mergeStyles(styles.button, styles.buttonOutline)}
					>
						Cancel
					</button>
				)}
			</div>
		</form>
	)

	// Modal wrapper
	if (asModal) {
		return (
			<>
				{/* Backdrop */}
				<div
					style={{
						position: 'fixed',
						inset: 0,
						backgroundColor: 'rgba(0, 0, 0, 0.5)',
						zIndex: 99,
						animation: 'sylphx-fade-in 0.15s ease-out',
					}}
					onClick={onClose}
				/>

				{/* Modal */}
				<div
					style={{
						position: 'fixed',
						top: '50%',
						left: '50%',
						transform: 'translate(-50%, -50%)',
						width: '100%',
						maxWidth: '420px',
						maxHeight: '90vh',
						overflow: 'auto',
						zIndex: 100,
						animation: 'sylphx-scale-in 0.15s ease-out',
					}}
					className={className}
				>
					<div style={styles.card}>
						<div style={styles.container}>
							<div style={mergeStyles(styles.cardHeader, styles.flexBetween)}>
								<div>
									<h2 style={styles.cardTitle}>Invite Member</h2>
									<p style={styles.cardDescription}>
										Invite a new member to {organization.name}
									</p>
								</div>
								<button
									type="button"
									onClick={onClose}
									style={{
										padding: '0.25rem',
										backgroundColor: 'transparent',
										border: 'none',
										cursor: 'pointer',
										color: theme.colorMutedForeground,
									}}
								>
									<XIcon size={20} />
								</button>
							</div>
							<div style={styles.cardContent}>{formContent}</div>
						</div>
					</div>
				</div>
			</>
		)
	}

	// Card wrapper (non-modal)
	return (
		<div style={styles.card} className={className}>
			<div style={styles.container}>
				<div style={styles.cardHeader}>
					<h2 style={styles.cardTitle}>Invite Member</h2>
					<p style={styles.cardDescription}>
						Invite a new member to {organization.name}
					</p>
				</div>
				<div style={styles.cardContent}>{formContent}</div>
			</div>
		</div>
	)
}

// Icons
function CheckIcon({ color, size = 24 }: { color: string; size?: number }) {
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
			style={{ flexShrink: 0 }}
		>
			<path d="M20 6 9 17l-5-5" />
		</svg>
	)
}

function SendIcon({ size = 24 }: { size?: number }) {
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
			<path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" />
			<path d="m21.854 2.147-10.94 10.939" />
		</svg>
	)
}

function XIcon({ size = 24 }: { size?: number }) {
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
			<path d="M18 6 6 18" />
			<path d="m6 6 12 12" />
		</svg>
	)
}
