'use client'

import { useSafeAuth, useSafeUser } from '@sylphx/sdk/react'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@sylphx/ui'
import { LogIn, LogOut, Settings, User } from 'lucide-react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { Link } from '@/lib/i18n/routing'
import { cn } from '@/lib/utils'

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

	const handleSignOut = async () => {
		await signOut()
		window.location.href = '/'
	}

	const avatarSize = size === 'sm' ? 'h-7 w-7' : 'h-8 w-8'
	const buttonSize = size === 'sm' ? 'h-10 w-10' : 'h-11 w-11'
	const menuWidth = size === 'sm' ? 'w-48' : 'w-56'

	// Loading state
	if (isLoading) {
		return (
			<div className={cn('flex items-center justify-center', buttonSize)}>
				<div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
			</div>
		)
	}

	// Authenticated user menu
	if (user) {
		return (
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<button
						type="button"
						className={cn(
							'flex items-center justify-center rounded-full transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
							size === 'sm' && 'text-muted-foreground hover:text-foreground',
							buttonSize,
						)}
						aria-label={t('common.userMenu')}
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
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className={menuWidth}>
					<DropdownMenuLabel className="font-normal">
						<div className="flex flex-col space-y-1">
							<p className="truncate text-sm font-medium">{user.name}</p>
							<p className="truncate text-xs text-muted-foreground">{user.email}</p>
						</div>
					</DropdownMenuLabel>
					<DropdownMenuSeparator />
					<DropdownMenuGroup>
						<DropdownMenuItem asChild>
							<Link href="/settings" className="flex items-center gap-2">
								<Settings className="h-4 w-4" />
								{t('common.settings')}
							</Link>
						</DropdownMenuItem>
					</DropdownMenuGroup>
					<DropdownMenuSeparator />
					<DropdownMenuItem destructive onClick={handleSignOut}>
						<LogOut className="mr-2 h-4 w-4" />
						{t('common.signOut')}
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
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
				size === 'sm' ? 'h-10 gap-1.5 rounded-full px-3 text-sm' : 'h-10 px-4 text-sm',
				signInClassName,
			)}
		>
			<LogIn className="h-4 w-4" />
			{size === 'md' && t('common.signIn')}
			{size === 'sm' && <span className="hidden sm:inline">{t('common.signIn')}</span>}
		</Link>
	)
}
