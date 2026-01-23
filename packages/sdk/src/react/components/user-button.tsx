/**
 * UserButton Component
 *
 * Displays user avatar with dropdown menu for profile/sign out.
 */

'use client'

import { useState, useRef, useEffect } from 'react'
import { useSafeUser, useSafeAuth, useSdkReady } from '../hooks'
import {
	type ThemeVariables,
	defaultTheme,
	injectGlobalStyles,
} from '../ui/styles'

export interface UserButtonProps {
	/** URL to redirect to after sign out */
	afterSignOutUrl?: string
	/** Theme variables */
	theme?: ThemeVariables
	/** Custom appearance */
	appearance?: {
		avatarSize?: number
		baseStyle?: React.CSSProperties
		menuStyle?: React.CSSProperties
	}
	/** Custom class name */
	className?: string
	/** Show user name next to avatar */
	showName?: boolean
}

/**
 * User avatar button with dropdown menu
 *
 * @example
 * ```tsx
 * <UserButton afterSignOutUrl="/" />
 *
 * // With name display
 * <UserButton showName afterSignOutUrl="/" />
 * ```
 */
export function UserButton({
	afterSignOutUrl = '/',
	theme = defaultTheme,
	appearance,
	className,
	showName = false,
}: UserButtonProps) {
	// SDK readiness check with silent fallback (returns null if not configured)
	const { isReady } = useSdkReady({
		services: ['auth', 'user'],
		componentType: 'user-button',
		theme,
		fallback: 'null', // Silent - don't show error, just return null
	})

	const { user, isLoaded, isSignedIn } = useSafeUser()
	const { signOut } = useSafeAuth()
	const [isOpen, setIsOpen] = useState(false)
	const menuRef = useRef<HTMLDivElement>(null)
	const buttonRef = useRef<HTMLButtonElement>(null)

	// Inject global styles
	useEffect(() => {
		injectGlobalStyles()
	}, [])

	// Close menu on outside click
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				menuRef.current &&
				buttonRef.current &&
				!menuRef.current.contains(event.target as Node) &&
				!buttonRef.current.contains(event.target as Node)
			) {
				setIsOpen(false)
			}
		}

		document.addEventListener('mousedown', handleClickOutside)
		return () => document.removeEventListener('mousedown', handleClickOutside)
	}, [])

	// Close menu on Escape key
	useEffect(() => {
		const handleEscape = (event: KeyboardEvent) => {
			if (event.key === 'Escape' && isOpen) {
				setIsOpen(false)
				buttonRef.current?.focus()
			}
		}

		document.addEventListener('keydown', handleEscape)
		return () => document.removeEventListener('keydown', handleEscape)
	}, [isOpen])

	// Don't render if SDK not ready or user not signed in
	if (!isReady || !isLoaded || !isSignedIn || !user) {
		return null
	}

	const avatarSize = appearance?.avatarSize || 32
	const initials = user.name
		? user.name
				.split(' ')
				.map((n: string) => n[0])
				.join('')
				.toUpperCase()
				.slice(0, 2)
		: user.email[0].toUpperCase()

	const handleSignOut = async () => {
		setIsOpen(false)
		await signOut({ redirectUrl: afterSignOutUrl })
	}

	const containerStyles: React.CSSProperties = {
		position: 'relative',
		display: 'inline-block',
		...appearance?.baseStyle,
	}

	const buttonStyles: React.CSSProperties = {
		display: 'flex',
		alignItems: 'center',
		gap: '0.5rem',
		padding: '0.25rem',
		border: 'none',
		background: 'transparent',
		cursor: 'pointer',
		borderRadius: '9999px',
	}

	const avatarStyles: React.CSSProperties = {
		width: avatarSize,
		height: avatarSize,
		borderRadius: '9999px',
		backgroundColor: theme.colorMuted,
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		fontSize: avatarSize * 0.4,
		fontWeight: 500,
		color: theme.colorMutedForeground,
		overflow: 'hidden',
	}

	const menuStyles: React.CSSProperties = {
		position: 'absolute',
		top: 'calc(100% + 0.5rem)',
		right: 0,
		minWidth: '200px',
		backgroundColor: theme.colorBackground,
		border: `1px solid ${theme.colorBorder}`,
		borderRadius: theme.borderRadius,
		boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
		zIndex: 50,
		overflow: 'hidden',
		...appearance?.menuStyle,
	}

	const menuItemStyles: React.CSSProperties = {
		display: 'block',
		width: '100%',
		padding: '0.75rem 1rem',
		textAlign: 'left',
		border: 'none',
		background: 'transparent',
		cursor: 'pointer',
		fontSize: theme.fontSizeSm,
		color: theme.colorForeground,
	}

	return (
		<div style={containerStyles} className={className}>
			<button
				ref={buttonRef}
				onClick={() => setIsOpen(!isOpen)}
				style={buttonStyles}
				type="button"
				aria-label={`User menu for ${user.name || user.email}`}
				aria-haspopup="menu"
				aria-expanded={isOpen}
			>
				<div style={avatarStyles} aria-hidden="true">
					{user.image ? (
						<img
							src={user.image}
							alt=""
							style={{
								width: '100%',
								height: '100%',
								objectFit: 'cover',
							}}
						/>
					) : (
						initials
					)}
				</div>
				{showName && (
					<span style={{ fontSize: theme.fontSizeSm, fontWeight: 500, color: theme.colorForeground }}>
						{user.name || user.email}
					</span>
				)}
			</button>

			{isOpen && (
				<div ref={menuRef} style={menuStyles} role="menu" aria-label="User menu">
					<div
						style={{
							padding: '0.75rem 1rem',
							borderBottom: `1px solid ${theme.colorBorder}`,
						}}
					>
						<p style={{ fontWeight: 500, fontSize: theme.fontSizeSm, color: theme.colorForeground }}>
							{user.name || 'User'}
						</p>
						<p
							style={{
								fontSize: theme.fontSizeXs,
								color: theme.colorMutedForeground,
								marginTop: '0.125rem',
							}}
						>
							{user.email}
						</p>
					</div>

					<button
						onClick={handleSignOut}
						style={menuItemStyles}
						type="button"
						role="menuitem"
						onMouseEnter={(e) => {
							e.currentTarget.style.backgroundColor = theme.colorMuted
						}}
						onMouseLeave={(e) => {
							e.currentTarget.style.backgroundColor = 'transparent'
						}}
						onFocus={(e) => {
							e.currentTarget.style.backgroundColor = theme.colorMuted
						}}
						onBlur={(e) => {
							e.currentTarget.style.backgroundColor = 'transparent'
						}}
					>
						Sign out
					</button>
				</div>
			)}
		</div>
	)
}
