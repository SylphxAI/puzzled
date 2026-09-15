'use client'

import {
	Bell,
	CreditCard,
	Gift,
	LayoutDashboard,
	Palette,
	Shield,
	ShieldCheck,
	User,
	UserCircle,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Link, usePathname } from '@/lib/i18n/routing'
import { cn } from '@/lib/utils'

const SETTINGS_LINKS = [
	{ href: '/settings', key: 'overview', icon: LayoutDashboard },
	{ href: '/settings/profile', key: 'profile', icon: UserCircle },
	{ href: '/settings/account', key: 'account', icon: User },
	{ href: '/settings/preferences', key: 'preferences', icon: Palette },
	{ href: '/settings/notifications', key: 'notifications', icon: Bell },
	{ href: '/settings/security', key: 'security', icon: ShieldCheck },
	{ href: '/settings/subscription', key: 'subscription', icon: CreditCard },
	{ href: '/settings/referrals', key: 'referrals', icon: Gift },
	{ href: '/settings/privacy', key: 'privacy', icon: Shield },
] as const

/**
 * Settings sections.
 *
 * The active section is stated with `aria-current`, not colour alone, and
 * every row is a 44px target on both the desktop rail and the mobile strip.
 */
export function SettingsNav() {
	const t = useTranslations('settings')
	const pathname = usePathname()

	return (
		<nav
			aria-label={t('nav.sections')}
			className="md:sticky md:top-24 md:self-start md:rounded-2xl md:border md:border-border/70 md:bg-surface-muted/50 md:p-2"
		>
			<ul className="-mx-4 flex gap-1 overflow-x-auto px-4 md:mx-0 md:flex-col md:gap-0.5 md:overflow-visible md:px-0">
				{SETTINGS_LINKS.map(({ href, key, icon: Icon }) => {
					const isActive = href === '/settings' ? pathname === href : pathname?.startsWith(href)
					return (
						<li key={href} className="shrink-0 md:shrink">
							<Link
								href={href}
								aria-current={isActive ? 'page' : undefined}
								className={cn(
									'flex min-h-11 items-center gap-2.5 whitespace-nowrap rounded-xl px-3 text-sm font-medium transition-colors',
									'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
									isActive
										? 'bg-primary/10 text-primary'
										: 'text-muted-foreground hover:bg-muted hover:text-foreground',
								)}
							>
								<Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
								{t(`nav.${key}`)}
							</Link>
						</li>
					)
				})}
			</ul>
		</nav>
	)
}
