import type { Metadata } from 'next'
import { useTranslations } from 'next-intl'
import { getTranslations } from 'next-intl/server'
import { PRIVACY_EMAIL } from '@/lib/config/app'

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations('legal.privacy')
	return {
		title: t('title'),
	}
}

export default function PrivacyPage() {
	const t = useTranslations('legal.privacy')

	return (
		<div className="flex flex-1 flex-col">
			<div className="border-b px-4 py-3">
				<h1 className="text-lg font-bold">{t('title')}</h1>
			</div>

			<div className="flex-1 overflow-y-auto px-4 py-6">
				<div className="mx-auto max-w-2xl space-y-6">
					<p className="text-sm text-muted-foreground">{t('lastUpdated')}: December 15, 2024</p>

					<section>
						<h2 className="text-base font-semibold">{t('sections.intro.title')}</h2>
						<p className="mt-2 text-sm text-muted-foreground">{t('sections.intro.content')}</p>
					</section>

					<section>
						<h2 className="text-base font-semibold">{t('sections.dataCollection.title')}</h2>
						<p className="mt-2 text-sm text-muted-foreground">
							{t('sections.dataCollection.content')}
						</p>
						<ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
							<li>{t('sections.dataCollection.items.account')}</li>
							<li>{t('sections.dataCollection.items.game')}</li>
							<li>{t('sections.dataCollection.items.payment')}</li>
							<li>{t('sections.dataCollection.items.technical')}</li>
						</ul>
					</section>

					<section>
						<h2 className="text-base font-semibold">{t('sections.dataUse.title')}</h2>
						<p className="mt-2 text-sm text-muted-foreground">{t('sections.dataUse.content')}</p>
						<ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
							<li>{t('sections.dataUse.items.service')}</li>
							<li>{t('sections.dataUse.items.improve')}</li>
							<li>{t('sections.dataUse.items.communicate')}</li>
							<li>{t('sections.dataUse.items.legal')}</li>
						</ul>
					</section>

					<section>
						<h2 className="text-base font-semibold">{t('sections.thirdParty.title')}</h2>
						<p className="mt-2 text-sm text-muted-foreground">{t('sections.thirdParty.content')}</p>
						<ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
							<li>
								<strong>Stripe</strong> - {t('sections.thirdParty.stripe')}
							</li>
							<li>
								<strong>Google</strong> - {t('sections.thirdParty.google')}
							</li>
							<li>
								<strong>Resend</strong> - {t('sections.thirdParty.resend')}
							</li>
						</ul>
					</section>

					<section>
						<h2 className="text-base font-semibold">{t('sections.cookies.title')}</h2>
						<p className="mt-2 text-sm text-muted-foreground">{t('sections.cookies.content')}</p>
					</section>

					<section>
						<h2 className="text-base font-semibold">{t('sections.rights.title')}</h2>
						<p className="mt-2 text-sm text-muted-foreground">{t('sections.rights.content')}</p>
						<ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
							<li>{t('sections.rights.items.access')}</li>
							<li>{t('sections.rights.items.correct')}</li>
							<li>{t('sections.rights.items.delete')}</li>
							<li>{t('sections.rights.items.export')}</li>
						</ul>
					</section>

					<section>
						<h2 className="text-base font-semibold">{t('sections.contact.title')}</h2>
						<p className="mt-2 text-sm text-muted-foreground">{t('sections.contact.content')}</p>
						<p className="mt-2 text-sm">
							<a href={`mailto:${PRIVACY_EMAIL}`} className="text-primary hover:underline">
								{PRIVACY_EMAIL}
							</a>
						</p>
					</section>
				</div>
			</div>
		</div>
	)
}
