/**
 * Referral Card Component
 *
 * Display referral program stats and share link.
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
import { RequireSdk } from '../hooks'
import { useReferral } from '../platform-hooks'
import { UI_COPY_FEEDBACK_MS } from '../../constants'

export interface ReferralCardProps {
	/** Theme variables */
	theme?: ThemeVariables
	/** Called on successful action */
	onSuccess?: (message: string) => void
	/** Called on error */
	onError?: (error: string) => void
	/** Custom class name */
	className?: string
	/** Card title */
	title?: string
	/** Card description */
	description?: string
	/** Show referral stats */
	showStats?: boolean
	/** Show share buttons */
	showShare?: boolean
	/** Reward description */
	rewardDescription?: string
}

/**
 * Referral program card
 *
 * @example
 * ```tsx
 * <ReferralCard
 *   title="Invite Friends"
 *   description="Earn rewards for each friend who signs up"
 *   rewardDescription="Get 1 month free for each referral"
 * />
 * ```
 */
export function ReferralCard(props: ReferralCardProps) {
	return (
		<RequireSdk services={['analytics']} componentType="referral" theme={props.theme}>
			<ReferralCardInner {...props} />
		</RequireSdk>
	)
}

/** Inner component that safely uses platform hooks */
function ReferralCardInner({
	theme = defaultTheme,
	onSuccess,
	onError,
	className,
	title = 'Refer a Friend',
	description = 'Share your referral link and earn rewards',
	showStats = true,
	showShare = true,
	rewardDescription = 'Earn rewards for each successful referral',
}: ReferralCardProps) {
	const { stats, code, link, isLoading, error: referralError, copyLink, copyCode, regenerateCode } = useReferral()
	const styles = baseStyles(theme)

	const [copied, setCopied] = useState<'link' | 'code' | null>(null)
	const [isRegenerating, setIsRegenerating] = useState(false)
	const [error, setError] = useState<string | null>(null)

	// Inject global styles
	useEffect(() => {
		injectGlobalStyles()
	}, [])

	// Clear copied state
	useEffect(() => {
		if (copied) {
			const timer = setTimeout(() => setCopied(null), UI_COPY_FEEDBACK_MS)
			return () => clearTimeout(timer)
		}
	}, [copied])

	// Handle copy link
	const handleCopyLink = async () => {
		try {
			await copyLink()
			setCopied('link')
			onSuccess?.('Link copied to clipboard')
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to copy link'
			setError(message)
			onError?.(message)
		}
	}

	// Handle copy code
	const handleCopyCode = async () => {
		try {
			await copyCode()
			setCopied('code')
			onSuccess?.('Code copied to clipboard')
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to copy code'
			setError(message)
			onError?.(message)
		}
	}

	// Handle regenerate code
	const handleRegenerateCode = async () => {
		if (!confirm('Are you sure? Your existing referral link will stop working.')) {
			return
		}

		setIsRegenerating(true)
		try {
			await regenerateCode()
			onSuccess?.('Referral code regenerated')
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to regenerate code'
			setError(message)
			onError?.(message)
		} finally {
			setIsRegenerating(false)
		}
	}

	// Share on Twitter/X
	const shareOnTwitter = () => {
		const text = encodeURIComponent(`Check this out! ${link}`)
		window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank')
	}

	// Share on LinkedIn
	const shareOnLinkedIn = () => {
		window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(link || '')}`, '_blank')
	}

	// Share via email
	const shareViaEmail = () => {
		const subject = encodeURIComponent('Check this out!')
		const body = encodeURIComponent(`I thought you might be interested in this: ${link}`)
		window.location.href = `mailto:?subject=${subject}&body=${body}`
	}

	const cardStyles: React.CSSProperties = mergeStyles(styles.card, {
		padding: '1.5rem',
	})

	if (isLoading) {
		return (
			<div style={cardStyles} className={className}>
				<div style={mergeStyles(styles.flexCenter, { padding: '2rem' })}>
					<span style={mergeStyles(styles.spinner, { width: '2rem', height: '2rem' })} />
				</div>
			</div>
		)
	}

	return (
		<div style={cardStyles} className={className}>
			{/* Header */}
			<div style={{ marginBottom: '1.5rem' }}>
				<h3 style={{ margin: 0, fontSize: theme.fontSizeLg, fontWeight: 600 }}>{title}</h3>
				<p style={mergeStyles(styles.textSm, styles.textMuted, { margin: '0.25rem 0 0' })}>
					{description}
				</p>
			</div>

			{/* Alerts */}
			{(error || referralError) && (
				<div style={mergeStyles(styles.alert, styles.alertError, styles.mb4)}>
					{error || referralError?.message}
				</div>
			)}

			{/* Referral Link */}
			{link && (
				<div style={{ marginBottom: '1.5rem' }}>
					<label style={styles.label}>Your Referral Link</label>
					<div style={mergeStyles(styles.flexRow, { gap: '0.5rem' })}>
						<input
							type="text"
							value={link}
							readOnly
							style={mergeStyles(styles.input, {
								flex: 1,
								backgroundColor: theme.colorMuted,
								fontSize: theme.fontSizeSm,
							})}
						/>
						<button
							type="button"
							onClick={handleCopyLink}
							style={mergeStyles(
								styles.button,
								copied === 'link' ? styles.buttonPrimary : styles.buttonOutline
							)}
						>
							{copied === 'link' ? (
								<>
									<CheckIcon size={16} />
									Copied!
								</>
							) : (
								<>
									<CopyIcon size={16} />
									Copy
								</>
							)}
						</button>
					</div>
				</div>
			)}

			{/* Referral Code */}
			{code && (
				<div style={{ marginBottom: '1.5rem' }}>
					<label style={styles.label}>Your Referral Code</label>
					<div style={mergeStyles(styles.flexRow, { gap: '0.5rem' })}>
						<div
							style={{
								flex: 1,
								padding: '0.5rem 1rem',
								backgroundColor: theme.colorMuted,
								borderRadius: theme.borderRadius,
								fontFamily: 'monospace',
								fontSize: theme.fontSizeLg,
								fontWeight: 600,
								letterSpacing: '0.05em',
								textAlign: 'center',
							}}
						>
							{code}
						</div>
						<button
							type="button"
							onClick={handleCopyCode}
							style={mergeStyles(
								styles.button,
								copied === 'code' ? styles.buttonPrimary : styles.buttonOutline
							)}
						>
							{copied === 'code' ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
						</button>
						<button
							type="button"
							onClick={handleRegenerateCode}
							disabled={isRegenerating}
							title="Regenerate code"
							style={mergeStyles(
								styles.button,
								styles.buttonOutline,
								isRegenerating ? styles.buttonDisabled : {}
							)}
						>
							{isRegenerating ? <span style={styles.spinner} /> : <RefreshIcon size={16} />}
						</button>
					</div>
				</div>
			)}

			{/* Reward Info */}
			{rewardDescription && (
				<div
					style={{
						padding: '1rem',
						backgroundColor: `${theme.colorPrimary}10`,
						borderRadius: theme.borderRadius,
						marginBottom: '1.5rem',
						display: 'flex',
						alignItems: 'center',
						gap: '0.75rem',
					}}
				>
					<GiftIcon color={theme.colorPrimary} />
					<span style={{ fontSize: theme.fontSizeSm, color: theme.colorForeground }}>
						{rewardDescription}
					</span>
				</div>
			)}

			{/* Stats */}
			{showStats && stats && (
				<div style={{ marginBottom: '1.5rem' }}>
					<div
						style={{
							display: 'grid',
							gridTemplateColumns: 'repeat(3, 1fr)',
							gap: '1rem',
							padding: '1rem',
							backgroundColor: theme.colorMuted,
							borderRadius: theme.borderRadius,
						}}
					>
						<div style={styles.textCenter}>
							<div style={{ fontSize: '1.5rem', fontWeight: 700 }}>
								{stats.totalReferrals || 0}
							</div>
							<div style={mergeStyles(styles.textXs, styles.textMuted)}>Total Referrals</div>
						</div>
						<div style={styles.textCenter}>
							<div style={{ fontSize: '1.5rem', fontWeight: 700, color: theme.colorSuccess }}>
								{stats.successfulReferrals || 0}
							</div>
							<div style={mergeStyles(styles.textXs, styles.textMuted)}>Successful</div>
						</div>
						<div style={styles.textCenter}>
							<div style={{ fontSize: '1.5rem', fontWeight: 700, color: theme.colorPrimary }}>
								{stats.pendingReferrals || 0}
							</div>
							<div style={mergeStyles(styles.textXs, styles.textMuted)}>Pending</div>
						</div>
					</div>
				</div>
			)}

			{/* Share Buttons */}
			{showShare && link && (
				<div>
					<label style={styles.label}>Share via</label>
					<div style={mergeStyles(styles.flexRow, { gap: '0.5rem', flexWrap: 'wrap' })}>
						<button
							type="button"
							onClick={shareOnTwitter}
							style={mergeStyles(styles.button, {
								backgroundColor: '#1DA1F2',
								color: '#fff',
							})}
						>
							<TwitterIcon size={16} />
							Twitter
						</button>
						<button
							type="button"
							onClick={shareOnLinkedIn}
							style={mergeStyles(styles.button, {
								backgroundColor: '#0077B5',
								color: '#fff',
							})}
						>
							<LinkedInIcon size={16} />
							LinkedIn
						</button>
						<button
							type="button"
							onClick={shareViaEmail}
							style={mergeStyles(styles.button, styles.buttonOutline)}
						>
							<EmailIcon size={16} />
							Email
						</button>
					</div>
				</div>
			)}
		</div>
	)
}

// Icons
function CopyIcon({ size = 24 }: { size?: number }) {
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
			<rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
			<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
		</svg>
	)
}

function CheckIcon({ size = 24 }: { size?: number }) {
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
			<polyline points="20 6 9 17 4 12" />
		</svg>
	)
}

function RefreshIcon({ size = 24 }: { size?: number }) {
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
			<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
			<path d="M21 3v5h-5" />
			<path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
			<path d="M8 16H3v5" />
		</svg>
	)
}

function GiftIcon({ color }: { color: string }) {
	return (
		<svg
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke={color}
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<polyline points="20 12 20 22 4 22 4 12" />
			<rect x="2" y="7" width="20" height="5" />
			<line x1="12" y1="22" x2="12" y2="7" />
			<path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
			<path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
		</svg>
	)
}

function TwitterIcon({ size = 24 }: { size?: number }) {
	return (
		<svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
			<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
		</svg>
	)
}

function LinkedInIcon({ size = 24 }: { size?: number }) {
	return (
		<svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
			<path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
		</svg>
	)
}

function EmailIcon({ size = 24 }: { size?: number }) {
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
			<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
			<polyline points="22,6 12,13 2,6" />
		</svg>
	)
}
