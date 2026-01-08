import { Camera, User, UserCircle } from 'lucide-react'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { requireServerUser } from '@/features/auth/server'
import { AvatarUpload, GameSettingsCard, ProfileForm } from '@/features/settings/components'

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

	// Auth is handled by layout, but we need user data for components
	const user = await requireServerUser(locale)
	const t = await getTranslations('settings')

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

			{/* Avatar Section */}
			<GameSettingsCard
				title={t('profile.avatar')}
				description={t('profile.avatarDescription')}
				iconElement={<Camera className="h-5 w-5 text-primary" />}
				variant="default"
			>
				<AvatarUpload
					currentImage={user.image ?? null}
					userName={user.name}
					userEmail={user.email}
				/>
			</GameSettingsCard>

			{/* Profile Information */}
			<GameSettingsCard
				title={t('profile.personalInfo')}
				description={t('profile.personalInfoDescription')}
				iconElement={<User className="h-5 w-5 text-primary" />}
				variant="default"
			>
				<ProfileForm
					user={{
						name: user.name,
						email: user.email,
						username: user.username ?? null,
						bio: user.bio ?? null,
					}}
				/>
			</GameSettingsCard>
		</div>
	)
}
