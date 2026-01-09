'use client'

import { ArrowLeft } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useSafeUser } from '@sylphx/platform-sdk/react'
import { Link } from '@/lib/i18n/routing'
import { SoundToggleCompact } from '@/shared/components/sound'
import { ThemeToggleCompact } from '@/shared/components/theme'
import { LanguageSwitcher } from './language-switcher'
import { Logo } from './logo'
import { UserMenu } from './user-menu'

type Props = {
	showBack?: boolean
	backHref?: string
	title?: string
}

/**
 * Header component for inner pages
 * Shows on mobile only - desktop uses TopNav from layout
 * Gracefully handles when Sylphx Platform is not configured.
 */
export function Header({ showBack = false, backHref = '/', title }: Props) {
	const t = useTranslations()
	const { user } = useSafeUser()

	// User ID available for guest data migration if needed
	void user?.id

	return (
		<header className="sticky top-0 z-header border-b bg-background/95 backdrop-blur-sm supports-[backdrop-filter]:bg-background/80 md:hidden">
			<div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
				{/* Left: Back button or Logo */}
				{showBack ? (
					<Link href={backHref} className="flex items-center gap-2 text-sm font-medium">
						<ArrowLeft className="h-5 w-5" />
						<span className="sr-only">{t('common.back')}</span>
					</Link>
				) : (
					<Logo size="sm" showText={true} />
				)}

				{/* Center: Title */}
				{title && (
					<h1 className="absolute left-1/2 -translate-x-1/2 text-sm font-semibold">{title}</h1>
				)}

				{/* Right: Actions */}
				<div className="flex items-center gap-1">
					<SoundToggleCompact />
					<ThemeToggleCompact />
					<LanguageSwitcher />
					<UserMenu size="sm" />
				</div>
			</div>
		</header>
	)
}
