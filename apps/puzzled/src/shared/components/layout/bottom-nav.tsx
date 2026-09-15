'use client'

import { useTranslations } from 'next-intl'
import { Link, usePathname } from '@/lib/i18n/routing'
import { cn } from '@/lib/utils'
import { isActivePath, NAV_ITEMS } from './nav-items'

/**
 * Mobile bottom bar. Four destinations keep every target at least 44px wide
 * on the narrowest supported viewport.
 */
export function BottomNav() {
	const t = useTranslations()
	const pathname = usePathname()
	const navItems = NAV_ITEMS.filter((item) => item.showInBottomNav)

	return (
		<nav
			className="fixed inset-x-0 bottom-0 z-bottom-nav border-t border-border/70 bg-background/85 pb-safe backdrop-blur-xl md:hidden"
			aria-label={t('nav.main')}
		>
			<div
				className="mx-auto grid h-16 max-w-md"
				style={{ gridTemplateColumns: `repeat(${navItems.length}, minmax(0, 1fr))` }}
			>
				{navItems.map(({ href, icon: Icon, labelKey }) => {
					const isActive = isActivePath(pathname, href)

					return (
						<Link
							key={href}
							href={href}
							aria-current={isActive ? 'page' : undefined}
							className={cn(
								'flex min-h-11 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors',
								isActive
									? 'text-primary'
									: 'text-muted-foreground hover:text-foreground active:scale-95',
							)}
						>
							<span
								className={cn(
									'flex h-8 w-14 items-center justify-center rounded-full transition-colors',
									isActive && 'bg-primary/12',
								)}
							>
								<Icon
									className={cn('h-5 w-5 transition-transform', isActive && 'scale-105')}
									aria-hidden="true"
								/>
							</span>
							<span>{t(`nav.${labelKey}`)}</span>
						</Link>
					)
				})}
			</div>
		</nav>
	)
}
