'use client'

import { useTranslations } from 'next-intl'
import { Link, usePathname } from '@/lib/i18n/routing'
import { cn } from '@/lib/utils'
import { isActivePath, NAV_ITEMS } from './nav-items'

/**
 * Phone tab bar, in the manner of an iOS tab bar: a translucent material
 * above the home indicator, five equal tabs, the current one in full ink with
 * a heavier icon stroke. Every tab is at least 64px wide at 320px.
 */
export function BottomNav() {
	const t = useTranslations()
	const pathname = usePathname()
	const navItems = NAV_ITEMS.filter((item) => item.showInBottomNav)

	return (
		<nav
			className="fixed inset-x-0 bottom-0 z-bottom-nav border-t border-hairline bg-background/85 pb-safe backdrop-blur-xl backdrop-saturate-150 md:hidden"
			aria-label={t('nav.main')}
		>
			<div
				className="mx-auto grid h-[58px] max-w-lg"
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
								'pressable flex min-h-11 flex-col items-center justify-center gap-0.5 text-[10.5px] font-medium tracking-tight transition-colors',
								isActive ? 'text-foreground' : 'text-muted-foreground',
							)}
						>
							<Icon className="h-6 w-6" strokeWidth={isActive ? 2.3 : 1.7} aria-hidden="true" />
							<span>{t(`nav.${labelKey}`)}</span>
						</Link>
					)
				})}
			</div>
		</nav>
	)
}
