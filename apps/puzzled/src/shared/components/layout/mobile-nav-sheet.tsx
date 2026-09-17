'use client'

import {
	Sheet,
	SheetClose,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from '@sylphx/ui'
import { Flame, Menu, Settings, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Link, usePathname } from '@/lib/i18n/routing'
import { cn } from '@/lib/utils'
import { SoundToggleCompact } from '@/shared/components/sound'
import { ThemeToggleCompact } from '@/shared/components/theme'
import { LanguageSwitcher } from './language-switcher'
import { Logo } from './logo'
import { isActivePath, NAV_ITEMS, SUPPORT_NAV_ITEM } from './nav-items'
import { UserMenu } from './user-menu'

/**
 * Mobile navigation sheet. Holds what the desktop bar shows inline: primary
 * destinations, support, appearance and language controls, and the account
 * entry point.
 */
export function MobileNavSheet({ currentStreak = 0 }: { currentStreak?: number }) {
	const t = useTranslations()
	const pathname = usePathname()
	const items = [...NAV_ITEMS, SUPPORT_NAV_ITEM]

	return (
		<Sheet>
			<SheetTrigger asChild>
				<button
					type="button"
					className="flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:hidden"
					aria-label={t('nav.openMenu')}
				>
					<Menu className="h-5 w-5" aria-hidden="true" />
				</button>
			</SheetTrigger>
			<SheetContent side="right" className="w-[min(20rem,88vw)] gap-0 p-0" hideCloseButton>
				<SheetHeader className="flex-row items-center justify-between gap-3 border-b px-5 py-4 text-left">
					<div>
						<SheetTitle className="sr-only">{t('nav.menuTitle')}</SheetTitle>
						<SheetDescription className="sr-only">{t('nav.main')}</SheetDescription>
						<Logo size="sm" />
					</div>
					<SheetClose asChild>
						<button
							type="button"
							className="flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
							aria-label={t('nav.closeMenu')}
						>
							<X className="h-5 w-5" aria-hidden="true" />
						</button>
					</SheetClose>
				</SheetHeader>

				<nav className="flex flex-col gap-1 p-3" aria-label={t('nav.main')}>
					{items.map(({ href, labelKey, icon: Icon }) => {
						const isActive = isActivePath(pathname, href)
						return (
							<SheetClose key={href} asChild>
								<Link
									href={href}
									aria-current={isActive ? 'page' : undefined}
									className={cn(
										'flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors',
										isActive ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted',
									)}
								>
									<Icon className="h-5 w-5" aria-hidden="true" />
									{t(`nav.${labelKey}`)}
								</Link>
							</SheetClose>
						)
					})}
				</nav>

				{currentStreak > 0 && (
					<div className="mx-3 flex items-center gap-2 rounded-xl bg-stat-streak/10 px-3 py-3 text-sm font-semibold text-stat-streak">
						<Flame className="h-4 w-4" aria-hidden="true" />
						<span className="tnum">{currentStreak}</span>
						<span className="font-medium">{t('stats.dayStreak')}</span>
					</div>
				)}

				<div className="mt-auto border-t p-3">
					<SheetClose asChild>
						<Link
							href="/settings"
							className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors hover:bg-muted"
						>
							<Settings className="h-5 w-5" aria-hidden="true" />
							{t('common.settings')}
						</Link>
					</SheetClose>
					<div className="flex items-center justify-between gap-2 px-2 py-2">
						<div className="flex items-center gap-1">
							<SoundToggleCompact />
							<ThemeToggleCompact />
						</div>
						<LanguageSwitcher variant="button" />
					</div>
					<div className="px-1 pt-1">
						<UserMenu size="sm" signInClassName="w-full justify-center" />
					</div>
				</div>
			</SheetContent>
		</Sheet>
	)
}
