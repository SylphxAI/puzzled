import { currentUser } from '@sylphx/sdk/nextjs'
import {
	Bell,
	CreditCard,
	Gift,
	LayoutDashboard,
	Palette,
	Shield,
	ShieldCheck,
	User,
} from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'

type Props = {
	params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props) {
	const { locale } = await params
	const t = await getTranslations({ locale, namespace: 'common' })
	return {
		title: t('settings'),
	}
}

const settingsCards = [
	{
		href: '/settings/profile',
		icon: User,
		labelKey: 'profile' as const,
		descKey: 'profileDesc' as const,
		color: 'from-blue-500/20 to-cyan-500/20',
		iconColor: 'text-blue-500',
	},
	{
		href: '/settings/account',
		icon: Shield,
		labelKey: 'account' as const,
		descKey: 'accountDesc' as const,
		color: 'from-purple-500/20 to-pink-500/20',
		iconColor: 'text-purple-500',
	},
	{
		href: '/settings/preferences',
		icon: Palette,
		labelKey: 'preferences' as const,
		descKey: 'preferencesDesc' as const,
		color: 'from-green-500/20 to-emerald-500/20',
		iconColor: 'text-green-500',
	},
	{
		href: '/settings/notifications',
		icon: Bell,
		labelKey: 'notifications' as const,
		descKey: 'notificationsDesc' as const,
		color: 'from-amber-500/20 to-orange-500/20',
		iconColor: 'text-amber-500',
	},
	{
		href: '/settings/security',
		icon: ShieldCheck,
		labelKey: 'security' as const,
		descKey: 'securityDesc' as const,
		color: 'from-red-500/20 to-rose-500/20',
		iconColor: 'text-red-500',
	},
	{
		href: '/settings/subscription',
		icon: CreditCard,
		labelKey: 'subscription' as const,
		descKey: 'subscriptionDesc' as const,
		color: 'from-indigo-500/20 to-violet-500/20',
		iconColor: 'text-indigo-500',
	},
	{
		href: '/settings/referrals',
		icon: Gift,
		labelKey: 'referrals' as const,
		descKey: 'referralsDesc' as const,
		color: 'from-pink-500/20 to-fuchsia-500/20',
		iconColor: 'text-pink-500',
	},
	{
		href: '/settings/privacy',
		icon: ShieldCheck,
		labelKey: 'privacy' as const,
		descKey: 'privacyDesc' as const,
		color: 'from-slate-500/20 to-gray-500/20',
		iconColor: 'text-slate-500',
	},
]

export default async function SettingsOverviewPage({ params }: Props) {
	const { locale } = await params
	setRequestLocale(locale)

	const user = await currentUser()

	if (!user) {
		redirect(`/${locale}/login?callbackUrl=/settings`)
	}

	const t = await getTranslations('settings')

	return (
		<div className="space-y-6">
			{/* Page Header */}
			<div className="flex items-center gap-3">
				<div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-violet-500/20">
					<LayoutDashboard className="h-6 w-6 text-primary" />
				</div>
				<div>
					<h1 className="text-xl font-semibold tracking-tight">{t('nav.overview')}</h1>
					<p className="text-sm text-muted-foreground">{t('nav.overviewDesc')}</p>
				</div>
			</div>

			{/* Quick Access Grid */}
			<div className="grid gap-3 sm:grid-cols-2">
				{settingsCards.map((card) => (
					<Link
						key={card.href}
						href={`/${locale}${card.href}`}
						className="group flex items-start gap-4 rounded-xl border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-sm"
					>
						<div
							className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${card.color}`}
						>
							<card.icon className={`h-5 w-5 ${card.iconColor}`} />
						</div>
						<div className="min-w-0 flex-1">
							<h3 className="font-medium leading-tight group-hover:text-primary">
								{t(`nav.${card.labelKey}`)}
							</h3>
							<p className="mt-0.5 text-sm text-muted-foreground">{t(`nav.${card.descKey}`)}</p>
						</div>
					</Link>
				))}
			</div>
		</div>
	)
}
