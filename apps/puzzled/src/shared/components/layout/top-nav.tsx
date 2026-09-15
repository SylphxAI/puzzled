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
 * The single shell header.
 *
 * It replaces the previous split model (desktop-only top nav plus a
 * page-local mobile header) so every surface shares one navigation, one
 * focus order, and one set of account controls.
 */
export function TopNav({ currentStreak = 0 }: TopNavProps) {
	const t = useTranslations()
	const pathname = usePathname()

	return (
		<header className="sticky top-0 z-header border-b border-border/70 bg-background/80 backdrop-blur-xl">
			<div className="page-shell-wide flex h-16 items-center gap-3">
				<Logo size="md" />

				<nav className="ml-2 hidden items-center gap-0.5 md:flex" aria-label={t('nav.main')}>
					{NAV_ITEMS.filter((item) => item.showInTopNav).map(({ href, labelKey }) => {
						const isActive = isActivePath(pathname, href)
						return (
							<Link
								key={href}
								href={href}
								aria-current={isActive ? 'page' : undefined}
								className={cn(
									// min-h-11 keeps the primary nav at the 44px company target.
									'inline-flex min-h-11 items-center rounded-full px-3.5 text-sm font-semibold transition-colors',
									isActive
										? 'bg-primary/10 text-primary'
										: 'text-muted-foreground hover:bg-muted hover:text-foreground',
								)}
							>
								{t(`nav.${labelKey}`)}
							</Link>
						)
					})}
				</nav>

				<div className="ml-auto flex items-center gap-1.5">
					{currentStreak > 0 && (
						<Link
							href="/stats"
							className="flex h-11 min-w-11 items-center gap-1.5 rounded-full bg-stat-streak/10 px-3 text-sm font-semibold text-stat-streak transition-colors hover:bg-stat-streak/15"
							aria-label={t('stats.streakLabel', { days: currentStreak })}
						>
							<Flame className="h-4 w-4" aria-hidden="true" />
							<span className="tnum">{currentStreak}</span>
						</Link>
					)}

					<div className="hidden items-center gap-1 md:flex">
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
