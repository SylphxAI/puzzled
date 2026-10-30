'use client'

import { LogIn, User } from 'lucide-react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { lazy, Suspense } from 'react'
import { Link } from '@/lib/i18n/routing'
import { useSafeAuth, useSafeUser } from '@/lib/identity/react'
import { cn } from '@/lib/utils'
import { useLazyMenu } from './use-lazy-menu'

// The dropdown runtime is fetched when the signed-in visitor reaches for the
// menu; until then the bar carries only the avatar button.
const loadMenu = () => import('./user-menu-dropdown')
const UserMenuDropdown = lazy(loadMenu)

type UserMenuProps = {
	/** Size variant for the trigger button */
	size?: 'sm' | 'md'
	/** Show sign-in button when not authenticated */
	showSignIn?: boolean
	/** Custom className for the sign-in button */
	signInClassName?: string
}

/**
 * User Menu Dropdown - shared component for navigation
 * Handles authenticated user menu and sign-in button
 * Gracefully handles when Sylphx Platform is not configured.
 */
export function UserMenu({ size = 'md', showSignIn = true, signInClassName }: UserMenuProps) {
	const t = useTranslations()
	const { user, isLoading } = useSafeUser()
	const { signOut } = useSafeAuth()
	const { opened, triggerProps } = useLazyMenu(loadMenu)

	const handleSignOut = async () => {
		await signOut()
		window.location.href = '/'
	}

	const avatarSize = size === 'sm' ? 'h-7 w-7' : 'h-8 w-8'
	// Both variants are 44px targets (company bar) in every shell bar.
	const buttonSize = 'h-11 w-11'
	const menuWidth = size === 'sm' ? 'w-48' : 'w-56'

	// Loading state
	if (isLoading) {
		return (
			// `<output>` carries the implicit status role, so the placeholder is
			// announced instead of appearing as an empty box.
			<output className={cn('flex items-center justify-center', buttonSize)}>
				<span className="sr-only">{t('common.loading')}</span>
				<div
					className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent"
					aria-hidden="true"
				/>
			</output>
		)
	}

	// Authenticated user menu
	if (user) {
		const trigger = (extra?: Record<string, unknown>) => (
			<button
				type="button"
				className={cn(
					'flex items-center justify-center rounded-full transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
					size === 'sm' && 'text-muted-foreground hover:text-foreground',
					buttonSize,
				)}
				aria-label={t('common.userMenu')}
				{...extra}
			>
				{user.image ? (
					<Image
						src={user.image}
						alt={`${user.name || 'User'}'s avatar`}
						width={size === 'sm' ? 28 : 32}
						height={size === 'sm' ? 28 : 32}
						className={cn('rounded-full', avatarSize)}
					/>
				) : size === 'sm' ? (
					<User className="h-5 w-5" />
				) : (
					<div
						className={cn(
							'flex items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground',
							avatarSize,
						)}
					>
						{user.name?.charAt(0) || user.email?.charAt(0) || '?'}
					</div>
				)}
			</button>
		)
		const plainTrigger = trigger(triggerProps)
		if (!opened) return plainTrigger
		return (
			<Suspense fallback={plainTrigger}>
				<UserMenuDropdown
					trigger={trigger()}
					name={user.name}
					email={user.email}
					menuWidth={menuWidth}
					onSignOut={handleSignOut}
				/>
			</Suspense>
		)
	}

	// Sign-in button
	if (!showSignIn) {
		return null
	}

	return (
		<Link
			href="/login"
			className={cn(
				'flex items-center gap-2 rounded-lg bg-primary font-medium text-primary-foreground transition-colors hover:bg-primary/90',
				size === 'sm' ? 'h-11 gap-1.5 rounded-full px-3 text-sm' : 'h-11 px-4 text-sm',
				signInClassName,
			)}
		>
			<LogIn className="h-4 w-4" aria-hidden="true" />
			{/* Visible at every width: the drawer's full-width button has room for it. */}
			{t('common.signIn')}
		</Link>
	)
}
