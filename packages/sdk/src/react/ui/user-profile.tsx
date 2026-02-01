/**
 * User Profile Component
 *
 * Full user profile management with avatar, name, and settings.
 * Self-contained with CSS-in-JS styles.
 */

'use client'

import { useState, useEffect, useCallback, useRef, type FormEvent } from 'react'
import type { ThemeVariables } from './styles'
import {
	defaultTheme,
	baseStyles,
	mergeStyles,
	injectGlobalStyles,
} from './styles'
import { useUser, RequireSdk } from '../hooks'
import { useStorage } from '../storage-hooks'
import { useUserContext } from '../services-context'
import { SecuritySettings } from './security-settings'
import { BillingSection } from './billing-section'
import { AccountSection } from './account-section'
import { NotificationSettings } from './notification-settings'
import { ReferralCard } from './referral-card'
import { UI_NOTIFICATION_MS } from '../../constants'

export type ProfileSection = 'profile' | 'security' | 'billing' | 'notifications' | 'account' | 'referrals' | 'connected-accounts'

export interface UserProfileProps {
	/** Theme variables */
	theme?: ThemeVariables
	/** Sections to show */
	sections?: ProfileSection[]
	/** Called on successful update */
	onSuccess?: (message: string) => void
	/** Called on error */
	onError?: (error: string) => void
	/** Show the card wrapper (default: true) */
	showCard?: boolean
	/** Custom header content */
	header?: React.ReactNode
	/** Custom footer content */
	footer?: React.ReactNode
	/** Whether this is in a modal */
	isModal?: boolean
	/** Called when close is requested (modal mode) */
	onClose?: () => void
}

interface ProfileFormState {
	name: string
	image: string
}

/**
 * User profile management component
 */
export function UserProfile(props: UserProfileProps) {
	return (
		<RequireSdk services={['auth', 'storage']} componentType="user" theme={props.theme}>
			<UserProfileInner {...props} />
		</RequireSdk>
	)
}

/** Inner component that safely uses platform hooks */
function UserProfileInner({
	theme = defaultTheme,
	sections = ['profile', 'security', 'notifications'],
	onSuccess,
	onError,
	showCard = true,
	header,
	footer,
	isModal = false,
	onClose,
}: UserProfileProps) {
	const { user, isLoading: isUserLoading, refresh: refreshUser } = useUser()
	const userContext = useUserContext()
	const { uploadAvatar, isUploading: isUploadingAvatar, uploadError } = useStorage()
	const styles = baseStyles(theme)

	const [activeSection, setActiveSection] = useState<ProfileSection>(sections[0])
	const [form, setForm] = useState<ProfileFormState>({ name: '', image: '' })
	const [error, setError] = useState<string | null>(null)
	const [success, setSuccess] = useState<string | null>(null)
	const [isLoading, setIsLoading] = useState(false)
	const fileInputRef = useRef<HTMLInputElement>(null)

	// Inject global styles
	useEffect(() => {
		injectGlobalStyles()
	}, [])

	// Populate form with user data
	useEffect(() => {
		if (user) {
			setForm({
				name: user.name || '',
				image: user.image || '',
			})
		}
	}, [user])

	// Clear messages after timeout
	useEffect(() => {
		if (success || error) {
			const timer = setTimeout(() => {
				setSuccess(null)
				setError(null)
			}, UI_NOTIFICATION_MS)
			return () => clearTimeout(timer)
		}
	}, [success, error])

	// Handle profile update
	const handleProfileUpdate = useCallback(
		async (e: FormEvent) => {
			e.preventDefault()
			setIsLoading(true)
			setError(null)
			setSuccess(null)

			try {
				await userContext.updateProfile({
					name: form.name,
					image: form.image,
				})

				setSuccess('Profile updated successfully')
				onSuccess?.('Profile updated successfully')
				refreshUser()
			} catch (err) {
				const message = err instanceof Error ? err.message : 'Failed to update profile'
				setError(message)
				onError?.(message)
			} finally {
				setIsLoading(false)
			}
		},
		[form, userContext, refreshUser, onSuccess, onError]
	)

	// Handle avatar upload
	const handleAvatarUpload = useCallback(
		async (file: File) => {
			setError(null)

			try {
				const imageUrl = await uploadAvatar(file)
				setForm((prev) => ({ ...prev, image: imageUrl }))
				setSuccess('Avatar uploaded')
			} catch (err) {
				const message = err instanceof Error ? err.message : 'Failed to upload avatar'
				setError(message)
				onError?.(message)
			}
		},
		[uploadAvatar, onError]
	)

	// Handle file input change
	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0]
		if (file) {
			if (file.size > 5 * 1024 * 1024) {
				setError('File size must be less than 5MB')
				return
			}
			if (!file.type.startsWith('image/')) {
				setError('File must be an image')
				return
			}
			handleAvatarUpload(file)
		}
	}

	// Render avatar
	const renderAvatar = () => {
		const avatarStyle: React.CSSProperties = {
			width: '6rem',
			height: '6rem',
			borderRadius: '50%',
			backgroundColor: theme.colorMuted,
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
			overflow: 'hidden',
			position: 'relative',
			cursor: 'pointer',
			border: `2px solid ${theme.colorBorder}`,
		}

		const overlayStyle: React.CSSProperties = {
			position: 'absolute',
			inset: 0,
			backgroundColor: 'rgba(0,0,0,0.5)',
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
			opacity: 0,
			transition: 'opacity 0.15s ease-in-out',
		}

		return (
			<div
				style={avatarStyle}
				onClick={() => fileInputRef.current?.click()}
				onMouseEnter={(e) => {
					const overlay = e.currentTarget.querySelector('.avatar-overlay') as HTMLElement
					if (overlay) overlay.style.opacity = '1'
				}}
				onMouseLeave={(e) => {
					const overlay = e.currentTarget.querySelector('.avatar-overlay') as HTMLElement
					if (overlay) overlay.style.opacity = '0'
				}}
			>
				{form.image ? (
					<img
						src={form.image}
						alt="Avatar"
						style={{ width: '100%', height: '100%', objectFit: 'cover' }}
					/>
				) : (
					<span style={{ fontSize: '2rem', color: theme.colorMutedForeground }}>
						{form.name?.charAt(0)?.toUpperCase() || '?'}
					</span>
				)}
				<div className="avatar-overlay" style={overlayStyle}>
					{isUploadingAvatar ? (
						<span style={mergeStyles(styles.spinner, { color: '#fff' })} />
					) : (
						<CameraIcon color="#fff" />
					)}
				</div>
				<input
					ref={fileInputRef}
					type="file"
					accept="image/*"
					onChange={handleFileChange}
					style={{ display: 'none' }}
				/>
			</div>
		)
	}

	// Render section tabs
	const renderSectionTabs = () => {
		if (sections.length <= 1) return null

		const sectionLabels: Record<ProfileSection, string> = {
			profile: 'Profile',
			security: 'Security',
			billing: 'Billing',
			notifications: 'Notifications',
			account: 'Account',
			referrals: 'Referrals',
			'connected-accounts': 'Connections',
		}

		return (
			<div style={styles.tabs}>
				{sections.map((section) => (
					<button
						key={section}
						type="button"
						onClick={() => setActiveSection(section)}
						style={mergeStyles(
							styles.tab,
							activeSection === section ? styles.tabActive : {}
						)}
					>
						{sectionLabels[section]}
					</button>
				))}
			</div>
		)
	}

	// Render profile section
	const renderProfileSection = () => (
		<form onSubmit={handleProfileUpdate}>
			{/* Avatar */}
			<div style={mergeStyles(styles.flexCenter, styles.mb6)}>
				{renderAvatar()}
			</div>

			{/* Name field */}
			<div style={styles.formGroup}>
				<label style={styles.label}>Name</label>
				<input
					type="text"
					value={form.name}
					onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
					placeholder="Your name"
					disabled={isLoading}
					style={mergeStyles(styles.input, isLoading ? styles.inputDisabled : {})}
				/>
			</div>

			{/* Email (read-only) */}
			<div style={styles.formGroup}>
				<label style={styles.label}>Email</label>
				<input
					type="email"
					value={user?.email || ''}
					disabled
					readOnly
					style={mergeStyles(styles.input, styles.inputDisabled)}
				/>
				<p style={mergeStyles(styles.textXs, styles.textMuted, styles.mt1)}>
					Email cannot be changed
				</p>
			</div>

			{/* Save button */}
			<button
				type="submit"
				disabled={isLoading}
				style={mergeStyles(
					styles.button,
					styles.buttonPrimary,
					styles.buttonFullWidth,
					isLoading ? styles.buttonDisabled : {}
				)}
			>
				{isLoading ? (
					<>
						<span style={styles.spinner} />
						Saving...
					</>
				) : (
					'Save Changes'
				)}
			</button>
		</form>
	)

	// Render security section using SecuritySettings component
	const renderSecuritySection = () => (
		<SecuritySettings
			theme={theme}
			onSuccess={onSuccess}
			onError={onError}
		/>
	)

	// Render billing section using BillingSection component
	const renderBillingSection = () => (
		<BillingSection
			theme={theme}
			onSuccess={onSuccess}
			onError={onError}
		/>
	)

	// Render account section using AccountSection component
	const renderAccountSection = () => (
		<AccountSection
			theme={theme}
			onSuccess={onSuccess}
			onError={onError}
		/>
	)

	// Render referrals section using ReferralCard component
	const renderReferralsSection = () => (
		<ReferralCard
			theme={theme}
			onSuccess={onSuccess}
			onError={onError}
		/>
	)

	// Render notifications section using NotificationSettings component
	const renderNotificationsSection = () => (
		<NotificationSettings
			theme={theme}
			onSuccess={onSuccess}
			onError={onError}
		/>
	)

	// Render connected accounts section
	const renderConnectedAccountsSection = () => (
		<div>
			<p style={mergeStyles(styles.textMuted, styles.textSm, styles.mb4)}>
				Manage connected third-party accounts.
			</p>

			<div
				style={mergeStyles(styles.card, {
					padding: '1rem',
				})}
			>
				<p style={mergeStyles(styles.textMuted, styles.textSm, styles.textCenter)}>
					No connected accounts
				</p>
			</div>
		</div>
	)

	// Render active section content
	const renderSectionContent = () => {
		switch (activeSection) {
			case 'profile':
				return renderProfileSection()
			case 'security':
				return renderSecuritySection()
			case 'billing':
				return renderBillingSection()
			case 'notifications':
				return renderNotificationsSection()
			case 'account':
				return renderAccountSection()
			case 'referrals':
				return renderReferralsSection()
			case 'connected-accounts':
				return renderConnectedAccountsSection()
			default:
				return renderProfileSection()
		}
	}

	// Loading state
	if (isUserLoading) {
		return (
			<div style={showCard ? styles.card : {}}>
				<div style={mergeStyles(styles.cardContent, styles.flexCenter, { minHeight: '12rem' })}>
					<div style={styles.flexCol}>
						<span style={mergeStyles(styles.spinner, { width: '2rem', height: '2rem', margin: '0 auto 1rem' })} />
						<p style={styles.textMuted}>Loading profile...</p>
					</div>
				</div>
			</div>
		)
	}

	// Not authenticated
	if (!user) {
		return (
			<div style={showCard ? styles.card : {}}>
				<div style={mergeStyles(styles.cardContent, styles.textCenter)}>
					<p style={styles.textMuted}>Please sign in to view your profile.</p>
				</div>
			</div>
		)
	}

	// Main content
	const content = (
		<div style={styles.container}>
			{/* Header */}
			{header || (
				<div style={mergeStyles(styles.cardHeader, isModal ? styles.flexBetween : styles.textCenter)}>
					<div>
						<h2 style={styles.cardTitle}>Your Profile</h2>
						<p style={styles.cardDescription}>Manage your account settings</p>
					</div>
					{isModal && onClose && (
						<button
							type="button"
							onClick={onClose}
							style={mergeStyles(styles.button, styles.buttonGhost)}
							aria-label="Close"
						>
							<CloseIcon color={theme.colorMutedForeground} />
						</button>
					)}
				</div>
			)}

			{/* Content */}
			<div style={styles.cardContent}>
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

				{/* Section tabs */}
				{renderSectionTabs()}

				{/* Section content */}
				{renderSectionContent()}

				{/* Footer */}
				{footer}
			</div>
		</div>
	)

	if (showCard) {
		return <div style={styles.card}>{content}</div>
	}

	return content
}

// Icons
function CameraIcon({ color }: { color: string }) {
	return (
		<svg
			width="24"
			height="24"
			viewBox="0 0 24 24"
			fill="none"
			stroke={color}
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
			<circle cx="12" cy="13" r="3" />
		</svg>
	)
}

function CloseIcon({ color }: { color: string }) {
	return (
		<svg
			width="16"
			height="16"
			viewBox="0 0 16 16"
			fill="none"
			stroke={color}
			strokeWidth="2"
			strokeLinecap="round"
		>
			<path d="M4 4L12 12M12 4L4 12" />
		</svg>
	)
}
