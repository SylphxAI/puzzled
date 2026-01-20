/**
 * UserButton Component
 *
 * Displays user avatar with dropdown menu for profile/sign out.
 */

'use client'

import { useState, useRef, useEffect } from 'react'
import { useUser, useAuth } from '../hooks'

export interface UserButtonProps {
	/** URL to redirect to after sign out */
	afterSignOutUrl?: string
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
	appearance,
	className,
	showName = false,
}: UserButtonProps) {
	const { user, isLoaded, isSignedIn } = useUser()
	const { signOut } = useAuth()
	const [isOpen, setIsOpen] = useState(false)
	const menuRef = useRef<HTMLDivElement>(null)
	const buttonRef = useRef<HTMLButtonElement>(null)

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

	// Don't show if not signed in
	if (!isLoaded || !isSignedIn || !user) {
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
		backgroundColor: '#e5e7eb',
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		fontSize: avatarSize * 0.4,
		fontWeight: 500,
		color: '#374151',
		overflow: 'hidden',
	}

	const menuStyles: React.CSSProperties = {
		position: 'absolute',
		top: 'calc(100% + 0.5rem)',
		right: 0,
		minWidth: '200px',
		backgroundColor: '#fff',
		border: '1px solid #e5e7eb',
		borderRadius: '0.5rem',
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
		fontSize: '0.875rem',
		color: '#374151',
	}

	return (
		<div style={containerStyles} className={className}>
			<button
				ref={buttonRef}
				onClick={() => setIsOpen(!isOpen)}
				style={buttonStyles}
				type="button"
				aria-haspopup="menu"
				aria-expanded={isOpen}
			>
				<div style={avatarStyles}>
					{user.image ? (
						<img
							src={user.image}
							alt={user.name || 'User'}
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
					<span style={{ fontSize: '0.875rem', fontWeight: 500 }}>
						{user.name || user.email}
					</span>
				)}
			</button>

			{isOpen && (
				<div ref={menuRef} style={menuStyles} role="menu">
					<div
						style={{
							padding: '0.75rem 1rem',
							borderBottom: '1px solid #e5e7eb',
						}}
					>
						<p style={{ fontWeight: 500, fontSize: '0.875rem' }}>
							{user.name || 'User'}
						</p>
						<p
							style={{
								fontSize: '0.75rem',
								color: '#6b7280',
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
							e.currentTarget.style.backgroundColor = '#f3f4f6'
						}}
						onMouseLeave={(e) => {
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
