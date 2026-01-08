'use client'

import { Bell, CreditCard, Eye, Home, Link2, Settings2, Shield, User } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Link, usePathname } from '@/lib/i18n/routing'
import { cn } from '@/lib/utils'
import { Badge } from '@/shared/components/ui'

type NavItem = {
	href: string
	icon: typeof Home
	label: string
	badge?: 'new' | 'beta'
	description?: string
}

const settingsNavItems: NavItem[] = [
	{
		href: '/settings',
		icon: Home,
		label: 'settings.nav.overview',
		description: 'settings.nav.overviewDesc',
	},
	{
		href: '/settings/profile',
		icon: User,
		label: 'settings.nav.profile',
		description: 'settings.nav.profileDesc',
	},
	{
		href: '/settings/account',
		icon: Link2,
		label: 'settings.nav.account',
		description: 'settings.nav.accountDesc',
	},
	{
		href: '/settings/security',
		icon: Shield,
		label: 'settings.nav.security',
		description: 'settings.nav.securityDesc',
	},
	{
		href: '/settings/subscription',
		icon: CreditCard,
		label: 'settings.nav.subscription',
		description: 'settings.nav.subscriptionDesc',
	},
	{
		href: '/settings/preferences',
		icon: Settings2,
		label: 'settings.nav.preferences',
		description: 'settings.nav.preferencesDesc',
	},
	{
		href: '/settings/notifications',
		icon: Bell,
		label: 'settings.nav.notifications',
		description: 'settings.nav.notificationsDesc',
	},
	{
		href: '/settings/privacy',
		icon: Eye,
		label: 'settings.nav.privacy',
		description: 'settings.nav.privacyDesc',
	},
]

export function SettingsSidebar() {
	const t = useTranslations()
	const pathname = usePathname()

	// Check if we're exactly on /settings (overview) or a sub-path
	const isOverview = pathname === '/settings'

	return (
		<>
			{/* Desktop Sidebar */}
			<aside className="hidden w-64 flex-shrink-0 md:block">
				<div className="sticky top-20 flex max-h-[calc(100vh-6rem)] flex-col">
					<nav className="flex-1 space-y-1 overflow-y-auto">
						{settingsNavItems.map((item) => {
							const Icon = item.icon
							const isActive =
								item.href === '/settings' ? isOverview : pathname.startsWith(item.href)

							return (
								<Link
									key={item.href}
									href={item.href}
									className={cn(
										'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all',
										isActive
											? 'bg-primary/10 text-primary'
											: 'text-muted-foreground hover:bg-muted hover:text-foreground',
									)}
								>
									<div
										className={cn(
											'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
											isActive ? 'bg-primary/20' : 'bg-muted group-hover:bg-muted-foreground/10',
										)}
									>
										<Icon className="h-4 w-4" />
									</div>
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-2">
											<span className="font-medium">{t(item.label)}</span>
											{item.badge === 'new' && (
												<Badge variant="default" className="h-5 px-1.5 text-[10px]">
													{t('settings.overview.badges.new')}
												</Badge>
											)}
											{item.badge === 'beta' && (
												<Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
													{t('settings.overview.badges.beta')}
												</Badge>
											)}
										</div>
									</div>
								</Link>
							)
						})}
					</nav>

					{/* Sidebar Footer - Fixed at bottom */}
					<div className="mt-4 flex-shrink-0 rounded-lg border bg-card p-3">
						<p className="text-xs text-muted-foreground">{t('settings.nav.helpText')}</p>
						<Link href="/help" className="mt-1 text-xs font-medium text-primary hover:underline">
							{t('settings.nav.helpLink')}
						</Link>
					</div>
				</div>
			</aside>

			{/* Mobile Tabs - Scrollable */}
			<div className="mb-6 md:hidden">
				<nav className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
					{settingsNavItems.map((item) => {
						const Icon = item.icon
						const isActive = item.href === '/settings' ? isOverview : pathname.startsWith(item.href)

						return (
							<Link
								key={item.href}
								href={item.href}
								className={cn(
									'relative flex flex-shrink-0 flex-col items-center gap-1 rounded-lg px-3 py-2 text-xs transition-colors',
									isActive
										? 'bg-primary/10 text-primary'
										: 'text-muted-foreground hover:bg-muted hover:text-foreground',
								)}
							>
								<Icon className="h-5 w-5" />
								<span className="whitespace-nowrap font-medium">{t(item.label).split(' ')[0]}</span>
								{item.badge === 'new' && (
									<span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-primary" />
								)}
							</Link>
						)
					})}
				</nav>
			</div>
		</>
	)
}
