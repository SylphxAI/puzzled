import { Globe, Palette, Settings } from 'lucide-react'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import {
	AppearanceSettings,
	GameCardRow,
	GameSettingsCard,
	LanguageSelector,
	RegionalSettings,
} from '@/features/settings/components'
import { getUserPreferences } from '@/features/settings/server'

type Props = {
	params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props) {
	const { locale } = await params
	const t = await getTranslations({ locale, namespace: 'settings' })

	return {
		title: t('preferences.title'),
	}
}

export default async function PreferencesPage({ params }: Props) {
	const { locale } = await params
	setRequestLocale(locale)

	// Auth is handled by layout - no need to check here
	const t = await getTranslations('settings')

	// Get user preferences
	const userPrefs = await getUserPreferences()

	return (
		<div className="space-y-6">
			{/* Page Header */}
			<div className="flex items-center gap-3">
				<div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20">
					<Settings className="h-6 w-6 text-violet-500" />
				</div>
				<div>
					<h1 className="text-xl font-semibold tracking-tight">{t('preferences.title')}</h1>
					<p className="text-sm text-muted-foreground">{t('preferences.description')}</p>
				</div>
			</div>

			{/* Appearance Section */}
			<GameSettingsCard
				title={t('preferences.appearance.title')}
				description={t('preferences.appearance.description')}
				iconElement={<Palette className="h-5 w-5 text-amber-500 dark:text-amber-400" />}
				variant="premium"
			>
				<AppearanceSettings
					initialReduceMotion={userPrefs?.reduceMotion ?? false}
					initialCompactMode={userPrefs?.compactMode ?? false}
				/>
			</GameSettingsCard>

			{/* Language & Region Section */}
			<GameSettingsCard
				title={t('preferences.language.title')}
				description={t('preferences.language.description')}
				iconElement={<Globe className="h-5 w-5 text-primary" />}
				variant="default"
			>
				<div className="space-y-4">
					{/* Language Selector */}
					<GameCardRow
						label={t('preferences.language.language')}
						description={t('preferences.language.languageDescription')}
					>
						<LanguageSelector />
					</GameCardRow>

					{/* Timezone and Date Format */}
					<RegionalSettings
						initialTimezone={userPrefs?.timezone ?? 'UTC'}
						initialDateFormat={userPrefs?.dateFormat ?? 'relative'}
					/>
				</div>
			</GameSettingsCard>
		</div>
	)
}
