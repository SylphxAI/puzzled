import { Button } from '@sylphx/ui'
import { ExternalLink, Eye, ShieldCheck } from 'lucide-react'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { ConsoleCard, ConsoleHeader } from '@/features/console/components/console-chrome'
import { requireMember } from '@/features/console/lib/require-member'
import { Link } from '@/lib/i18n/routing'
import { buildPageMetadata } from '@/lib/seo/metadata'

type Props = {
	params: Promise<{ locale: string }>
}

/** The account centre that owns privacy and data controls. */
const PRIVACY_CENTRE_URL = 'https://platform.sylphx.com/settings/privacy'

export async function generateMetadata({ params }: Props) {
	const { locale } = await params
	const t = await getTranslations({ locale, namespace: 'settings' })

	return buildPageMetadata({
		locale,
		path: '/settings/privacy',
		title: t('privacy.title'),
		description: t('privacy.description'),
		noindex: true,
	})
}

export default async function PrivacySettingsPage({ params }: Props) {
	const { locale } = await params
	setRequestLocale(locale)

	await requireMember({ locale, returnTo: '/settings/privacy' })

	const t = await getTranslations('settings')

	return (
		<>
			<ConsoleHeader
				headingLevel={2}
				title={t('privacy.title')}
				description={t('privacy.description')}
			/>

			<ConsoleCard
				title={t('privacy.centreTitle')}
				description={t('privacy.centreDescription')}
				actions={
					<Button asChild className="min-h-11 gap-2">
						<a href={PRIVACY_CENTRE_URL} target="_blank" rel="noopener noreferrer">
							{t('privacy.centreCta')}
							<ExternalLink className="h-4 w-4" aria-hidden="true" />
						</a>
					</Button>
				}
			>
				<ul className="space-y-2 text-sm text-muted-foreground">
					<li className="flex items-start gap-2">
						<Eye className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
						{t('privacy.centreVisibility')}
					</li>
					<li className="flex items-start gap-2">
						<ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
						{t('privacy.centreData')}
					</li>
					<li className="flex items-start gap-2">
						<ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
						{t('privacy.centreDeletion')}
					</li>
				</ul>
				<p className="mt-3 text-xs leading-relaxed text-muted-foreground">
					{t('privacy.centreNote')}
				</p>
			</ConsoleCard>

			<ConsoleCard
				title={t('privacy.boardsTitle')}
				description={t('privacy.boardsDescription')}
				actions={
					<Link
						href="/leaderboard"
						className="inline-flex min-h-11 items-center rounded-xl border border-border bg-background px-4 text-sm font-semibold transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
					>
						{t('privacy.boardsCta')}
					</Link>
				}
			>
				<p className="text-sm leading-relaxed text-muted-foreground">{t('privacy.boardsBody')}</p>
			</ConsoleCard>
		</>
	)
}
