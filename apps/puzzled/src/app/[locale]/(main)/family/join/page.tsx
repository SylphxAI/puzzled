import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/lib/i18n/routing'
import { currentUser } from '@/lib/identity/server'
import { withPresentationDeadline } from '@/lib/presentation-document'
import { buildPageMetadata } from '@/lib/seo/metadata'
import { JoinFamilyButton } from './join-button'

type Props = {
	params: Promise<{ locale: string }>
	searchParams: Promise<{ code?: string }>
}

export async function generateMetadata({ params }: Props) {
	const { locale } = await params
	const t = await getTranslations({ locale, namespace: 'plus.family' })
	return buildPageMetadata({
		locale,
		path: '/family/join',
		title: t('joinTitle'),
		description: t('joinBody'),
		noindex: true,
	})
}

/** Landing page of a family invite link. The api checks the code and the plan. */
export default async function JoinFamilyPage({ params, searchParams }: Props) {
	const { locale } = await params
	const { code = '' } = await searchParams
	setRequestLocale(locale)
	const t = await getTranslations('plus.family')
	const user = await withPresentationDeadline(currentUser(), null)
	const returnTo = `/family/join?code=${encodeURIComponent(code)}`

	return (
		<main className="page-shell flex-1 py-10">
			<div className="surface-card mx-auto max-w-lg space-y-4 p-6">
				<h1 className="font-display text-2xl">{t('joinTitle')}</h1>
				<p className="text-sm text-muted-foreground">{t('joinBody')}</p>
				{user ? (
					<JoinFamilyButton code={code} />
				) : (
					<Link
						href={{ pathname: '/login', query: { callbackUrl: returnTo } }}
						className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-primary px-5 font-semibold text-primary-foreground"
					>
						{t('signInToJoin')}
					</Link>
				)}
			</div>
		</main>
	)
}
