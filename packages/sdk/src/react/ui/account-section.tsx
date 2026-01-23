/**
 * Account Section Component
 *
 * Account management: email change, data export, account deletion.
 * Self-contained with CSS-in-JS styles.
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import type { ThemeVariables } from './styles'
import {
	defaultTheme,
	baseStyles,
	mergeStyles,
	injectGlobalStyles,
} from './styles'
import { useUser, useAuth, RequireSdk } from '../hooks'
import { useUserContext, useSecurityContext } from '../services-context'

export interface AccountSectionProps {
	/** Theme variables */
	theme?: ThemeVariables
	/** Called on successful action */
	onSuccess?: (message: string) => void
	/** Called on error */
	onError?: (error: string) => void
	/** Custom class name */
	className?: string
	/** Show email change option */
	showEmailChange?: boolean
	/** Show data export option */
	showDataExport?: boolean
	/** Show account deletion option */
	showDeleteAccount?: boolean
	/** URL to redirect after account deletion */
	afterDeleteUrl?: string
}

/**
 * Account management section
 *
 * @example
 * ```tsx
 * <AccountSection
 *   onSuccess={(msg) => toast.success(msg)}
 *   afterDeleteUrl="/"
 * />
 * ```
 */
export function AccountSection(props: AccountSectionProps) {
	return (
		<RequireSdk services={['auth']} componentType="account" theme={props.theme}>
			<AccountSectionInner {...props} />
		</RequireSdk>
	)
}

/** Inner component that safely uses platform hooks */
function AccountSectionInner({
	theme = defaultTheme,
	onSuccess,
	onError,
	className,
	showEmailChange = true,
	showDataExport = true,
	showDeleteAccount = true,
	afterDeleteUrl = '/',
}: AccountSectionProps) {
	const { user } = useUser()
	const { signOut } = useAuth()
	const userContext = useUserContext()
	const securityContext = useSecurityContext()
	const styles = baseStyles(theme)

	// State
	const [error, setError] = useState<string | null>(null)
	const [success, setSuccess] = useState<string | null>(null)

	// Email change state
	const [showEmailChangeForm, setShowEmailChangeForm] = useState(false)
	const [newEmail, setNewEmail] = useState('')
	const [emailPassword, setEmailPassword] = useState('')
	const [isChangingEmail, setIsChangingEmail] = useState(false)

	// Data export state
	const [isExporting, setIsExporting] = useState(false)
	const [exportUrl, setExportUrl] = useState<string | null>(null)

	// Delete account state
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
	const [deleteConfirmText, setDeleteConfirmText] = useState('')
	const [isDeleting, setIsDeleting] = useState(false)

	// Inject global styles
	useEffect(() => {
		injectGlobalStyles()
	}, [])

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

	// Handle email change request
	const handleEmailChange = async (e: React.FormEvent) => {
		e.preventDefault()

		if (!newEmail || !newEmail.includes('@')) {
			setError('Please enter a valid email address')
			return
		}

		setIsChangingEmail(true)
		setError(null)

		try {
			const result = await securityContext.emailChangeRequest(newEmail)
			setShowEmailChangeForm(false)
			setNewEmail('')
			setEmailPassword('')
			setSuccess(result.message || 'Verification email sent to your new address. Please check your inbox.')
			onSuccess?.('Verification email sent')
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to change email'
			setError(message)
			onError?.(message)
		} finally {
			setIsChangingEmail(false)
		}
	}

	// Handle data export
	const handleDataExport = async () => {
		setIsExporting(true)
		setError(null)

		try {
			const data = await userContext.exportData()
			setExportUrl(data.downloadUrl)
			setSuccess('Your data export is ready for download')
			onSuccess?.('Data export ready')
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to export data'
			setError(message)
			onError?.(message)
		} finally {
			setIsExporting(false)
		}
	}

	// Handle account deletion
	const handleDeleteAccount = async () => {
		if (deleteConfirmText !== 'DELETE') {
			setError('Please type DELETE to confirm')
			return
		}

		setIsDeleting(true)
		setError(null)

		try {
			await userContext.deleteAccount()
			setSuccess('Account deleted. Redirecting...')
			onSuccess?.('Account deleted')

			// Sign out and redirect
			setTimeout(async () => {
				await signOut({ redirectUrl: afterDeleteUrl })
			}, 1500)
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to delete account'
			setError(message)
			onError?.(message)
			setIsDeleting(false)
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
			{error && (
				<div style={mergeStyles(styles.alert, styles.alertError, styles.mb4)}>
					{error}
				</div>
			)}

			{/* Email Change */}
			{showEmailChange && (
				<div style={cardStyles}>
					<div style={styles.flexBetween}>
						<div>
							<h4 style={{ margin: 0, fontWeight: 500 }}>Email Address</h4>
							<p style={mergeStyles(styles.textSm, styles.textMuted, { margin: '0.25rem 0 0' })}>
								{user?.email}
							</p>
						</div>
						{!showEmailChangeForm && (
							<button
								type="button"
								onClick={() => setShowEmailChangeForm(true)}
								style={mergeStyles(styles.button, styles.buttonOutline)}
							>
								Change
							</button>
						)}
					</div>

					{showEmailChangeForm && (
						<form
							onSubmit={handleEmailChange}
							style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: `1px solid ${theme.colorBorder}` }}
						>
							<div style={styles.formGroup}>
								<label style={styles.label}>New Email Address</label>
								<input
									type="email"
									value={newEmail}
									onChange={(e) => setNewEmail(e.target.value)}
									placeholder="new@example.com"
									required
									style={styles.input}
								/>
							</div>
							<div style={styles.formGroup}>
								<label style={styles.label}>Current Password</label>
								<input
									type="password"
									value={emailPassword}
									onChange={(e) => setEmailPassword(e.target.value)}
									placeholder="Enter your password to confirm"
									required
									style={styles.input}
								/>
							</div>
							<div style={mergeStyles(styles.flexRow, { gap: '0.5rem' })}>
								<button
									type="submit"
									disabled={isChangingEmail}
									style={mergeStyles(
										styles.button,
										styles.buttonPrimary,
										isChangingEmail ? styles.buttonDisabled : {}
									)}
								>
									{isChangingEmail ? (
										<>
											<span style={styles.spinner} />
											Sending...
										</>
									) : (
										'Send Verification'
									)}
								</button>
								<button
									type="button"
									onClick={() => {
										setShowEmailChangeForm(false)
										setNewEmail('')
										setEmailPassword('')
									}}
									style={mergeStyles(styles.button, styles.buttonOutline)}
								>
									Cancel
								</button>
							</div>
						</form>
					)}
				</div>
			)}

			{/* Data Export */}
			{showDataExport && (
				<div style={cardStyles}>
					<div style={styles.flexBetween}>
						<div>
							<h4 style={{ margin: 0, fontWeight: 500 }}>Export Your Data</h4>
							<p style={mergeStyles(styles.textSm, styles.textMuted, { margin: '0.25rem 0 0' })}>
								Download a copy of all your data
							</p>
						</div>
						{!exportUrl ? (
							<button
								type="button"
								onClick={handleDataExport}
								disabled={isExporting}
								style={mergeStyles(
									styles.button,
									styles.buttonOutline,
									isExporting ? styles.buttonDisabled : {}
								)}
							>
								{isExporting ? (
									<>
										<span style={styles.spinner} />
										Preparing...
									</>
								) : (
									<>
										<DownloadIcon size={16} />
										Export
									</>
								)}
							</button>
						) : (
							<a
								href={exportUrl}
								download
								style={mergeStyles(styles.button, styles.buttonPrimary)}
							>
								<DownloadIcon size={16} />
								Download
							</a>
						)}
					</div>
				</div>
			)}

			{/* Delete Account */}
			{showDeleteAccount && (
				<div
					style={mergeStyles(cardStyles, {
						borderColor: theme.colorDestructive,
						backgroundColor: `${theme.colorDestructive}05`,
					})}
				>
					<div style={styles.flexBetween}>
						<div>
							<h4 style={{ margin: 0, fontWeight: 500, color: theme.colorDestructive }}>
								Delete Account
							</h4>
							<p style={mergeStyles(styles.textSm, styles.textMuted, { margin: '0.25rem 0 0' })}>
								Permanently delete your account and all data
							</p>
						</div>
						{!showDeleteConfirm && (
							<button
								type="button"
								onClick={() => setShowDeleteConfirm(true)}
								style={mergeStyles(styles.button, styles.buttonDestructive)}
							>
								<TrashIcon size={16} />
								Delete Account
							</button>
						)}
					</div>

					{showDeleteConfirm && (
						<div
							style={{
								marginTop: '1rem',
								paddingTop: '1rem',
								borderTop: `1px solid ${theme.colorDestructive}30`,
							}}
						>
							<div
								style={mergeStyles(styles.alert, styles.alertError, {
									backgroundColor: `${theme.colorDestructive}10`,
								})}
							>
								<strong>Warning:</strong> This action cannot be undone. All your data will be permanently
								deleted.
							</div>

							<p style={mergeStyles(styles.textSm, styles.textMuted, { margin: '1rem 0 0.5rem' })}>
								Type <strong>DELETE</strong> to confirm:
							</p>
							<input
								type="text"
								value={deleteConfirmText}
								onChange={(e) => setDeleteConfirmText(e.target.value)}
								placeholder="DELETE"
								style={mergeStyles(styles.input, { marginBottom: '1rem' })}
							/>

							<div style={mergeStyles(styles.flexRow, { gap: '0.5rem' })}>
								<button
									type="button"
									onClick={handleDeleteAccount}
									disabled={isDeleting || deleteConfirmText !== 'DELETE'}
									style={mergeStyles(
										styles.button,
										styles.buttonDestructive,
										(isDeleting || deleteConfirmText !== 'DELETE') ? styles.buttonDisabled : {}
									)}
								>
									{isDeleting ? (
										<>
											<span style={styles.spinner} />
											Deleting...
										</>
									) : (
										'Permanently Delete'
									)}
								</button>
								<button
									type="button"
									onClick={() => {
										setShowDeleteConfirm(false)
										setDeleteConfirmText('')
									}}
									style={mergeStyles(styles.button, styles.buttonOutline)}
								>
									Cancel
								</button>
							</div>
						</div>
					)}
				</div>
			)}
		</div>
	)
}

// Icons
function DownloadIcon({ size = 24 }: { size?: number }) {
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
			<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
			<polyline points="7 10 12 15 17 10" />
			<line x1="12" y1="15" x2="12" y2="3" />
		</svg>
	)
}

function TrashIcon({ size = 24 }: { size?: number }) {
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
			<polyline points="3 6 5 6 21 6" />
			<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
		</svg>
	)
}
