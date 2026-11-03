import { Button } from '@sylphx/ui'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { SUPPORT_EMAIL } from '@/lib/config/app'
import { Link } from '@/lib/i18n/routing'
import { currentUser } from '@/lib/identity/server'
import { buildPageMetadata } from '@/lib/seo/metadata'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props) {
	const { locale } = await params
	const t = await getTranslations({ locale, namespace: 'settings' })
	return buildPageMetadata({
		locale,
		path: '/delete-account',
		title: t('deletePage.title'),
		description: t('deletePage.description'),
	})
}

/** Public instructions: never require a session just to find the deletion route. */
export default async function DeleteAccountPage({ params }: Props) {
	const { locale } = await params
	setRequestLocale(locale)
	const t = await getTranslations('settings')
	const user = await currentUser()
	const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Puzzled account deletion request')}`
	return (
		<main className="page-shell-wide max-w-3xl space-y-6 py-10">
			<h1 className="font-display text-3xl font-semibold">{t('deletePage.title')}</h1>
			<p className="text-muted-foreground">{t('deletePage.description')}</p>
			<section className="space-y-4 rounded-2xl border border-border p-6">
				<h2 className="text-xl font-semibold">{t('deletePage.stepsTitle')}</h2>
				<p>{t('deletePage.steps')}</p>
				<Button asChild className="min-h-11">
					<Link
						href={
							user
								? '/settings/account'
								: { pathname: '/login', query: { callbackUrl: '/settings/account' } }
						}
					>
						{user ? t('account.deleteCta') : t('deletePage.signIn')}
					</Link>
				</Button>
				<p>{t('deletePage.erased')}</p>
				<p className="text-sm text-muted-foreground">{t('deletePage.retained')}</p>
				<Link href="/privacy" className="inline-flex min-h-11 items-center text-primary underline">
					{t('deletePage.privacy')}
				</Link>
			</section>
			<section className="space-y-3 rounded-2xl border border-border p-6">
				<h2 className="text-xl font-semibold">{t('deletePage.helpTitle')}</h2>
				<p>{t('deletePage.help')}</p>
				<div className="flex flex-wrap gap-4">
					<Link
						href="/forgot-password"
						className="inline-flex min-h-11 items-center text-primary underline"
					>
						{t('deletePage.recover')}
					</Link>
					<a href={mailto} className="inline-flex min-h-11 items-center text-primary underline">
						{t('deletePage.email', { email: SUPPORT_EMAIL })}
					</a>
				</div>
			</section>
		</main>
	)
}
