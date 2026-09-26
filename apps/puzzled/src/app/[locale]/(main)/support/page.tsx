import {
	ArrowRight,
	Check,
	Clock,
	KeyRound,
	Lock,
	type LucideIcon,
	Mail,
	ScrollText,
	ShieldCheck,
} from 'lucide-react'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import {
	MarketingCta,
	MarketingFaq,
	type MarketingFaqItem,
	MarketingHero,
	MarketingSection,
} from '@/features/marketing/components'
import { APP_NAME, LEGAL_EMAIL, PRIVACY_EMAIL, SUPPORT_EMAIL } from '@/lib/config/app'
import { Link } from '@/lib/i18n/routing'
import { buildPageMetadata, ogImagePath } from '@/lib/seo/metadata'

type Props = {
	params: Promise<{ locale: string }>
}

/**
 * Support questions arrive in this order: getting back in, money, the daily
 * habit, access, then data. Every answer is checked against the code that
 * implements it; anything a person must decide points back at the inbox.
 */
const FAQ_KEYS = [
	'signIn',
	'guest',
	'cancel',
	'afterCancel',
	'refunds',
	'dayStart',
	'streak',
	'accessibility',
	'data',
] as const

/** Fields a support message needs before a person can act on it. */
const INCLUDE_KEYS = ['account', 'game', 'detail', 'screenshot'] as const

type ResourceKey = 'reset' | 'privacy' | 'terms'

/** Routes that exist today; the FAQ answers point at the same destinations. */
const RESOURCES: Record<ResourceKey, { href: string; icon: LucideIcon }> = {
	reset: { href: '/forgot-password', icon: KeyRound },
	privacy: { href: '/privacy', icon: ShieldCheck },
	terms: { href: '/terms', icon: ScrollText },
}

const RESOURCE_KEYS: readonly ResourceKey[] = ['reset', 'privacy', 'terms']

const PRIMARY_CTA =
	'inline-flex h-12 items-center gap-2 rounded-2xl bg-primary px-6 font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-transform hover:-translate-y-0.5 hover:bg-primary-hover active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'

const SECONDARY_CTA =
	'inline-flex h-12 items-center gap-2 rounded-2xl border border-border bg-background/80 px-5 font-semibold backdrop-blur transition-colors hover:border-primary/30 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'

const INLINE_LINK =
	'inline-flex min-h-11 items-center gap-2 font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'

export async function generateMetadata({ params }: Props) {
	const { locale } = await params
	const t = await getTranslations({ locale, namespace: 'support' })

	return buildPageMetadata({
		locale,
		path: '/support',
		title: t('title'),
		description: t('description'),
		imagePath: ogImagePath({
			title: t('title'),
			subtitle: t('hero.lead'),
			eyebrow: t('hero.eyebrow'),
		}),
	})
}

export default async function SupportPage({ params }: Props) {
	const { locale } = await params
	setRequestLocale(locale)

	const t = await getTranslations('support')

	// One prefilled subject keeps every mailto on this page in the same thread.
	const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`${APP_NAME} Support Request`)}`

	// Two answers quote an address, so the reader never has to leave the page to
	// find it; both are the same addresses the contact cards above offer.
	const faqItems: MarketingFaqItem[] = FAQ_KEYS.map((key) => {
		const values =
			key === 'refunds'
				? { email: SUPPORT_EMAIL }
				: key === 'data'
					? { email: PRIVACY_EMAIL }
					: undefined
		return {
			question: t(`faq.${key}.question`),
			answer: t(`faq.${key}.answer`, values),
		}
	})

	return (
		<main className="flex-1">
			<MarketingHero
				eyebrow={t('hero.eyebrow')}
				title={t('title')}
				lead={t('hero.lead')}
				facts={[t('hero.factHuman'), t('hero.factReply')]}
				actions={
					<>
						<a href={mailto} className={PRIMARY_CTA}>
							<Mail className="h-4 w-4" aria-hidden="true" />
							{t('hero.emailCta')}
						</a>
						<a href="#faq" className={SECONDARY_CTA}>
							{t('hero.faqCta')}
							<ArrowRight className="h-4 w-4" aria-hidden="true" />
						</a>
					</>
				}
				aside={
					<div
						className="surface-card shadow-glow animate-enter p-5 md:p-6"
						style={{ '--enter-delay': '120ms' } as React.CSSProperties}
					>
						<h2 className="font-display text-base">{t('include.title')}</h2>
						<ul className="mt-3 space-y-2.5 text-sm leading-relaxed text-muted-foreground">
							{INCLUDE_KEYS.map((key) => (
								<li key={key} className="flex gap-2.5">
									<Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
									<span>{t(`include.${key}`)}</span>
								</li>
							))}
						</ul>
					</div>
				}
			/>

			<MarketingSection
				id="contact"
				title={t('contact.title')}
				subtitle={t('contact.subtitle')}
				flush
			>
				<ul className="grid gap-3 md:grid-cols-2">
					<li className="surface-card p-5 md:p-6">
						<span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
							<Mail className="h-5 w-5" aria-hidden="true" />
						</span>
						<h3 className="mt-3 font-display text-base">{t('contact.support.title')}</h3>
						<p className="mt-1 text-sm leading-relaxed text-muted-foreground">
							{t('contact.support.body')}
						</p>
						<a href={mailto} className={`${INLINE_LINK} mt-3`}>
							<Mail className="h-4 w-4" aria-hidden="true" />
							{SUPPORT_EMAIL}
						</a>
						<p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
							<Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
							{t('email.responseTime')}
						</p>
					</li>
					<li className="surface-card p-5 md:p-6">
						<span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
							<Lock className="h-5 w-5" aria-hidden="true" />
						</span>
						<h3 className="mt-3 font-display text-base">{t('contact.data.title')}</h3>
						<p className="mt-1 text-sm leading-relaxed text-muted-foreground">
							{t('contact.data.body', { privacy: PRIVACY_EMAIL, legal: LEGAL_EMAIL })}
						</p>
						<div className="mt-3 flex flex-col items-start">
							<a href={`mailto:${PRIVACY_EMAIL}`} className={INLINE_LINK}>
								<Mail className="h-4 w-4" aria-hidden="true" />
								{PRIVACY_EMAIL}
							</a>
							<a href={`mailto:${LEGAL_EMAIL}`} className={INLINE_LINK}>
								<Mail className="h-4 w-4" aria-hidden="true" />
								{LEGAL_EMAIL}
							</a>
						</div>
					</li>
				</ul>
				<p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
					{t('contact.note')}
				</p>
			</MarketingSection>

			<MarketingFaq
				id="faq"
				title={t('faq.title')}
				subtitle={t('faq.subtitle')}
				items={faqItems}
				columns={2}
			/>

			<MarketingSection
				id="resources"
				title={t('resources.title')}
				subtitle={t('resources.subtitle')}
			>
				<ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{RESOURCE_KEYS.map((key) => {
						const { href, icon: Icon } = RESOURCES[key]
						return (
							<li key={key}>
								<Link
									href={href}
									className="surface-card surface-card-hover flex min-h-11 items-start gap-3 p-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
								>
									<Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
									<span>
										<span className="block font-display text-base">
											{t(`resources.${key}.title`)}
										</span>
										<span className="mt-1 block text-sm leading-relaxed text-muted-foreground">
											{t(`resources.${key}.body`)}
										</span>
									</span>
								</Link>
							</li>
						)
					})}
				</ul>
			</MarketingSection>

			<MarketingCta title={t('cta.title')} body={t('cta.body')} note={SUPPORT_EMAIL}>
				<a href={mailto} className={PRIMARY_CTA}>
					<Mail className="h-4 w-4" aria-hidden="true" />
					{t('hero.emailCta')}
				</a>
			</MarketingCta>
		</main>
	)
}
