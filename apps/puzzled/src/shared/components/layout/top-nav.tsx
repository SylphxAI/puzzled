'use client'

import { Flame } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useGuestDataMigration, useSession } from '@/features/auth'
import { Link, usePathname } from '@/lib/i18n/routing'
import { cn } from '@/lib/utils'
import { Logo } from './logo'
import { UserMenu } from './user-menu'

const navItems = [
	{ href: '/', labelKey: 'nav.home' },
	{ href: '/stats', labelKey: 'nav.stats' },
	{ href: '/leaderboard', labelKey: 'nav.leaderboard' },
] as const

type TopNavProps = {
	currentStreak?: number
}

/**
 * Desktop top navigation - hidden on mobile, shown on md+ screens
 */
export function TopNav({ currentStreak = 0 }: TopNavProps) {
	const t = useTranslations()
	const pathname = usePathname()
	const { data: session } = useSession()

	// Migrate guest data to server when user logs in
	useGuestDataMigration(session?.user?.id)

	return (
		<header className="sticky top-0 z-header hidden border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:block">
			<div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
				{/* Left: Logo + Nav Links */}
				<div className="flex items-center gap-8">
					<Logo size="md" />

					<nav className="flex items-center gap-1" aria-label={t('nav.main')}>
						{navItems.map(({ href, labelKey }) => {
							const isActive = pathname === href || (href !== '/' && pathname.startsWith(href))

							return (
								<Link
									key={href}
									href={href}
									aria-current={isActive ? 'page' : undefined}
									className={cn(
										'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
										isActive
											? 'bg-muted text-foreground'
											: 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
									)}
								>
									{t(labelKey)}
								</Link>
							)
						})}
					</nav>
				</div>

				{/* Right: Streak + User Menu */}
				<div className="flex items-center gap-4">
					{/* Streak indicator */}
					{currentStreak > 0 && (
						<div className="flex items-center gap-1.5 rounded-full bg-stat-streak/10 px-3 py-1.5">
							<Flame className="h-4 w-4 text-stat-streak" aria-hidden="true" />
							<span className="text-sm font-semibold text-stat-streak">{currentStreak}</span>
						</div>
					)}

					<UserMenu size="md" />
				</div>
			</div>
		</header>
	)
}
