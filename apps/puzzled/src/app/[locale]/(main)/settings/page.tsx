import { Bell, ChevronRight, Palette, Shield, ShieldCheck, UserCircle, UserCog } from 'lucide-react'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { ConsoleCard } from '@/features/console/components/console-chrome'
import { requireMember } from '@/features/console/lib/require-member'
import { Link } from '@/lib/i18n/routing'

type Props = {
	params: Promise<{ locale: string }>
}

type SettingsLink = {
	href: string
	key: 'profile' | 'account' | 'preferences' | 'notifications' | 'security' | 'privacy'
	icon: typeof UserCircle
}

const GROUPS: { key: 'player' | 'play' | 'safety'; links: SettingsLink[] }[] = [
	{
		key: 'player',
		links: [
			{ href: '/settings/profile', key: 'profile', icon: UserCircle },
			{ href: '/settings/account', key: 'account', icon: UserCog },
		],
	},
	{
		key: 'play',
		links: [
			{ href: '/settings/preferences', key: 'preferences', icon: Palette },
			{ href: '/settings/notifications', key: 'notifications', icon: Bell },
		],
	},
	{
		key: 'safety',
		links: [
			{ href: '/settings/security', key: 'security', icon: ShieldCheck },
			{ href: '/settings/privacy', key: 'privacy', icon: Shield },
		],
	},
]

export default async function SettingsOverviewPage({ params }: Props) {
	const { locale } = await params
	setRequestLocale(locale)

	const t = await getTranslations('settings')
	const user = await requireMember({ locale, returnTo: '/settings' })
	if (!user) return null
	const displayName = user?.name?.trim() || user?.email || t('playerCard.nameFallback')

	return (
		<>
			<div className="flex flex-wrap items-center gap-2">
				<span className="chip bg-primary/10 text-primary">
					{t('overview.signedInAs', { name: displayName })}
				</span>
			</div>

			{GROUPS.map((group) => (
				<ConsoleCard
					key={group.key}
					title={t(`overview.groups.${group.key}`)}
					description={t(`overview.groups.${group.key}Desc`)}
				>
					<ul className="grid gap-2 sm:grid-cols-2">
						{group.links.map(({ href, key, icon: Icon }) => (
							<li key={href}>
								<Link
									href={href}
									className="flex min-h-11 items-center gap-3 rounded-xl border border-border/70 bg-surface-muted/60 px-3 py-2.5 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
								>
									<Icon className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
									<span className="min-w-0 flex-1">
										<span className="block text-sm font-semibold">{t(`nav.${key}`)}</span>
										<span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
											{t(`nav.${key}Desc`)}
										</span>
									</span>
									<ChevronRight
										className="h-4 w-4 shrink-0 text-muted-foreground"
										aria-hidden="true"
									/>
								</Link>
							</li>
						))}
					</ul>
				</ConsoleCard>
			))}
		</>
	)
}
