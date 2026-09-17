export const dynamic = 'force-dynamic'

import { Globe, Palette } from 'lucide-react'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { ConsoleCard, ConsoleHeader } from '@/features/console/components/console-chrome'
import { requireMember } from '@/features/console/lib/require-member'
import { buildPageMetadata } from '@/lib/seo/metadata'
import { LanguageSwitcher } from '@/shared/components/layout'
import { ThemeToggle } from '@/shared/components/theme'

type Props = {
	params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props) {
	const { locale } = await params
	const t = await getTranslations({ locale, namespace: 'settings' })

	return buildPageMetadata({
		locale,
		path: '/settings/preferences',
		title: t('preferences.title'),
		description: t('preferences.description'),
		noindex: true,
	})
}

export default async function PreferencesPage({ params }: Props) {
	const { locale } = await params
	setRequestLocale(locale)

	await requireMember({ locale, returnTo: '/settings/preferences' })

	const t = await getTranslations('settings')

	return (
		<>
			<ConsoleHeader
				headingLevel={2}
				title={t('preferences.title')}
				description={t('preferences.description')}
			/>

			<ConsoleCard
				title={t('preferences.appearance.title')}
				description={t('preferences.appearance.description')}
			>
				<div className="flex items-start gap-3">
					<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10">
						<Palette className="h-5 w-5 text-violet-500" aria-hidden="true" />
					</span>
					<div className="min-w-0 flex-1">
						<p className="text-sm font-semibold">{t('preferences.appearance.theme')}</p>
						<p className="mb-3 text-xs leading-relaxed text-muted-foreground">
							{t('preferences.appearance.themeDescription')}
						</p>
						<ThemeToggle showLabel />
					</div>
				</div>
			</ConsoleCard>

			<ConsoleCard
				title={t('preferences.language.title')}
				description={t('preferences.language.description')}
			>
				<div className="flex items-start gap-3">
					<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
						<Globe className="h-5 w-5 text-primary" aria-hidden="true" />
					</span>
					<div className="min-w-0 flex-1">
						<p className="text-sm font-semibold">{t('preferences.language.language')}</p>
						<p className="mb-3 text-xs leading-relaxed text-muted-foreground">
							{t('preferences.language.languageDescription')}
						</p>
						<LanguageSwitcher variant="button" />
					</div>
				</div>
			</ConsoleCard>
		</>
	)
}
