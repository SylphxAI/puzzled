'use client'

import { Flame } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Link, usePathname } from '@/lib/i18n/routing'
import { cn } from '@/lib/utils'
import { ThemeToggleCompact } from '@/shared/components/theme'
import { LanguageSwitcher } from './language-switcher'
import { Logo } from './logo'
import { MobileNavSheet } from './mobile-nav-sheet'
import { isActivePath, NAV_ITEMS } from './nav-items'
import { UserMenu } from './user-menu'

type TopNavProps = {
	currentStreak?: number
}

/**
 * The shell header: a translucent bar with the lockup, the day's destinations
 * as editorial text links (an ink underline marks the current one), and the
 * account controls. On a phone the destinations move to the tab bar and the
 * header keeps only the lockup, the streak and the menu.
 */
export function TopNav({ currentStreak = 0 }: TopNavProps) {
	const t = useTranslations()
	const pathname = usePathname()

	return (
		<header className="pt-safe sticky top-0 z-header border-b border-hairline bg-background/80 backdrop-blur-xl backdrop-saturate-150">
			<div className="page-shell-wide flex h-14 items-center gap-2 md:h-16">
				<Logo size="md" />

				<nav className="ml-6 hidden items-center gap-1 md:flex" aria-label={t('nav.main')}>
					{NAV_ITEMS.filter((item) => item.showInTopNav).map(({ href, labelKey }) => {
						const isActive = isActivePath(pathname, href)
						return (
							<Link
								key={href}
								href={href}
								aria-current={isActive ? 'page' : undefined}
								className={cn(
									'relative inline-flex min-h-11 items-center px-3 text-[15px] font-medium transition-colors',
									'after:absolute after:inset-x-3 after:bottom-1.5 after:h-0.5 after:rounded-full after:bg-foreground after:transition-transform after:duration-medium after:ease-out',
									isActive
										? 'text-foreground after:scale-x-100'
										: 'text-muted-foreground after:scale-x-0 hover:text-foreground',
								)}
							>
								{t(`nav.${labelKey}`)}
							</Link>
						)
					})}
				</nav>

				<div className="ml-auto flex items-center gap-1">
					{currentStreak > 0 && (
						<Link
							href="/stats"
							className="pressable flex h-11 min-w-11 items-center gap-1 rounded-full px-3 text-sm font-semibold text-stat-streak"
							aria-label={t('stats.streakLabel', { days: currentStreak })}
						>
							<Flame className="h-4 w-4" aria-hidden="true" />
							<span className="tnum">{currentStreak}</span>
						</Link>
					)}

					<Link
						href="/pricing"
						className={cn(
							'hidden h-9 items-center rounded-full border border-border px-3.5 text-sm font-semibold transition-colors hover:border-foreground/30 lg:inline-flex',
							isActivePath(pathname, '/pricing') && 'border-foreground/40',
						)}
					>
						<span
							className="mr-1.5 inline-block h-2 w-2 rounded-[2px] bg-accent-warm"
							aria-hidden="true"
						/>
						{t('nav.plus')}
					</Link>

					<div className="hidden items-center md:flex">
						<ThemeToggleCompact />
						<LanguageSwitcher />
					</div>

					<div className="hidden md:block">
						<UserMenu size="md" />
					</div>

					<MobileNavSheet currentStreak={currentStreak} />
				</div>
			</div>
		</header>
	)
}
