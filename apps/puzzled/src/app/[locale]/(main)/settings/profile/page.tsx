import { UserCircle } from 'lucide-react'
import { redirect } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { currentUser } from '@sylphx/platform-sdk/nextjs'
import { Avatar, AvatarFallback, AvatarImage } from '@sylphx/ui'

type Props = {
	params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props) {
	const { locale } = await params
	const t = await getTranslations({ locale, namespace: 'settings' })

	return {
		title: t('profile.title'),
	}
}

export default async function ProfileSettingsPage({ params }: Props) {
	const { locale } = await params
	setRequestLocale(locale)

	const user = await currentUser()

	if (!user) {
		redirect(`/${locale}/login?callbackUrl=/settings/profile`)
	}

	const t = await getTranslations('settings')

	// Get initials for avatar fallback
	const initials = user.name
		? user.name
				.split(' ')
				.map((n) => n[0])
				.join('')
				.toUpperCase()
				.slice(0, 2)
		: user.email?.charAt(0).toUpperCase() || '?'

	return (
		<div className="space-y-6">
			{/* Page Header */}
			<div className="flex items-center gap-3">
				<div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500/20 to-pink-500/20">
					<UserCircle className="h-6 w-6 text-rose-500" />
				</div>
				<div>
					<h1 className="text-xl font-semibold tracking-tight">{t('profile.title')}</h1>
					<p className="text-sm text-muted-foreground">{t('profile.description')}</p>
				</div>
			</div>

			{/* Profile Card */}
			<div className="rounded-2xl border bg-card p-6">
				<div className="flex items-start gap-4">
					<Avatar className="h-16 w-16">
						<AvatarImage src={user.image || undefined} alt={user.name || 'Profile'} />
						<AvatarFallback className="text-lg">{initials}</AvatarFallback>
					</Avatar>
					<div className="flex-1 space-y-1">
						<h2 className="text-lg font-semibold">{user.name || 'Anonymous User'}</h2>
						<p className="text-sm text-muted-foreground">{user.email}</p>
					</div>
				</div>

				<div className="mt-6 rounded-xl border bg-muted/30 p-4">
					<p className="text-sm text-muted-foreground">
						Profile editing is coming soon. You can manage your profile through the Sylphx
						Platform settings.
					</p>
				</div>
			</div>
		</div>
	)
}
