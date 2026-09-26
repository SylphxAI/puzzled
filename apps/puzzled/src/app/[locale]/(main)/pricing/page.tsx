import { Check, Play } from 'lucide-react'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { MarketingHero, MarketingSection } from '@/features/marketing/components'
import { getAllGameMetadata } from '@/games/registry'
import { getServerPlans, getServerPlusAccess } from '@/lib/api/server'
import {
	currencyForLocale,
	formatPrice,
	type PlanCard,
	planCards,
	yearlySavingPercent,
} from '@/lib/billing/plus'
import { getTodaysFreeGame } from '@/lib/free-rotation'
import { slugToCamelCase } from '@/lib/game-slug'
import { Link } from '@/lib/i18n/routing'
import { currentUser } from '@/lib/identity/server'
import { withPresentationDeadline } from '@/lib/presentation-document'
import { buildPageMetadata, ogImagePath } from '@/lib/seo/metadata'
import { cn } from '@/lib/utils'
import { SubscribeButton } from './subscribe-button'

type Props = {
	params: Promise<{ locale: string }>
	searchParams: Promise<{ checkout?: string }>
}

export async function generateMetadata({ params }: Props) {
	const { locale } = await params
	const t = await getTranslations({ locale, namespace: 'plus.pricing' })
	const tPlus = await getTranslations({ locale, namespace: 'plus' })
	return buildPageMetadata({
		locale,
		path: '/pricing',
		title: t('metaTitle'),
		description: t('metaDescription'),
		imagePath: ogImagePath({
			title: t('metaTitle'),
			subtitle: t('lead', { count: getAllGameMetadata().length }),
			eyebrow: tPlus('name'),
		}),
	})
}

/**
 * Puzzled Plus plans. Every amount is Stripe's published price (ListPlans),
 * tax included, in the currency checkout will charge; nothing is hardcoded.
 * While sales are closed the page says everything is free.
 */
export default async function PricingPage({ params, searchParams }: Props) {
	const { locale } = await params
	const { checkout } = await searchParams
	setRequestLocale(locale)

	const t = await getTranslations('plus.pricing')
	const tPlus = await getTranslations('plus')
	const tGames = await getTranslations('games')
	const user = await withPresentationDeadline(currentUser(), null)
	const [plans, access] = await Promise.all([
		withPresentationDeadline(getServerPlans(), null),
		withPresentationDeadline(getServerPlusAccess(Boolean(user)), null),
	])

	const gameCount = getAllGameMetadata().length
	const freeSlug = getTodaysFreeGame()
	const freeName = tGames(`${slugToCamelCase(freeSlug)}.name`)
	const currency = currencyForLocale(locale)
	const cards = plans?.salesOpen ? planCards(plans.plans, currency) : []
	const monthly = (family: boolean) =>
		cards.find((c) => c.family === family && c.interval === 'month')
	const yearly = (family: boolean) =>
		cards.find((c) => c.family === family && c.interval === 'year')
	const familyMax = plans?.familyMaxMembers ?? 4
	const cancellationDays = plans?.cancellationDays ?? 14

	const groups = [
		{ family: false, title: tPlus('name'), body: t('individualBody') },
		{ family: true, title: t('family'), body: t('familyBody', { count: familyMax }) },
	]
	const includes = (family: boolean) => [
		t('includesAllGames', { count: gameCount }),
		t('includesArchive'),
		t('includesStats'),
		...(family ? [t('includesFamily', { count: familyMax })] : []),
	]

	const priceLine = (card: PlanCard | undefined) =>
		card ? formatPrice(card.amountMinor, card.currency, locale) : null

	return (
		<main className="flex-1">
			<MarketingHero
				eyebrow={tPlus('name')}
				title={t('title')}
				lead={t('lead', { count: gameCount })}
				actions={
					<Link
						href={`/games/${freeSlug}`}
						className="pressable inline-flex h-12 items-center gap-2 rounded-full border border-border bg-card px-5 font-semibold transition-colors hover:bg-muted"
					>
						<Play className="h-4 w-4" aria-hidden="true" />
						{t('playFree', { game: freeName })}
					</Link>
				}
			/>

			<MarketingSection id="plans" flush>
				{checkout === 'cancelled' ? (
					<output className="mb-4 block rounded-xl bg-muted px-4 py-3 text-sm">
						{t('checkoutCancelled')}
					</output>
				) : null}

				{cards.length === 0 ? (
					<div className="surface-card max-w-xl p-6 sm:p-7">
						<p className="flex items-center gap-2 text-sm font-semibold">
							<span
								className="inline-block h-2.5 w-2.5 rounded-[3px] bg-accent-warm"
								aria-hidden="true"
							/>
							{tPlus('name')}
						</p>
						<h2 className="mt-2 font-display text-2xl">{t('closedTitle')}</h2>
						<p className="mt-2 text-[15px] text-muted-foreground">{t('closedBody')}</p>
						<ul className="mt-5 space-y-2.5 border-t border-border pt-5">
							{includes(true).map((line) => (
								<li key={line} className="flex items-start gap-2.5 text-[15px]">
									<Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
									{line}
								</li>
							))}
						</ul>
					</div>
				) : (
					<>
						<ul className="grid gap-4 lg:grid-cols-3">
							<li className="flex flex-col rounded-2xl border border-border p-5 sm:p-6">
								<h2 className="font-display text-xl">{t('freeTitle')}</h2>
								<p className="mt-1 text-sm text-muted-foreground">{t('freeBody')}</p>
								<p className="mt-5 font-display text-3xl tnum">
									{formatPrice(0, currency, locale)}
								</p>
								<div className="mt-auto pt-5">
									<Link
										href={`/games/${freeSlug}`}
										className="pressable inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-border bg-card px-5 font-semibold transition-colors hover:bg-muted"
									>
										<Play className="h-4 w-4" aria-hidden="true" />
										{t('playFree', { game: freeName })}
									</Link>
								</div>
							</li>
							{groups.map((group) => {
								const month = monthly(group.family)
								const year = yearly(group.family)
								const saving =
									month && year ? yearlySavingPercent(month.amountMinor, year.amountMinor) : null
								return (
									<li
										key={group.title}
										className={cn(
											'surface-card flex flex-col p-5 sm:p-6',
											!group.family && 'border-2 border-foreground shadow-lg',
										)}
									>
										<h2 className="flex items-center gap-2 font-display text-xl">
											{!group.family ? (
												<span
													className="inline-block h-2.5 w-2.5 rounded-[3px] bg-accent-warm"
													aria-hidden="true"
												/>
											) : null}
											{group.title}
										</h2>
										<p className="mt-1 text-sm text-muted-foreground">{group.body}</p>
										<dl className="mt-5 space-y-1">
											{month ? (
												<div className="flex flex-wrap items-baseline gap-1.5">
													<dt className="sr-only">{t('monthly')}</dt>
													<dd className="font-display text-4xl tnum">{priceLine(month)}</dd>
													<dd className="text-sm text-muted-foreground">{t('perMonth')}</dd>
												</div>
											) : null}
											{year ? (
												<div className="flex flex-wrap items-baseline gap-1.5 text-sm">
													<dt className="sr-only">{t('yearly')}</dt>
													<dd className="font-semibold tnum">{priceLine(year)}</dd>
													<dd className="text-muted-foreground">{t('perYear')}</dd>
													{saving ? (
														<dd className="chip bg-success/15 text-success">
															{t('saving', { percent: saving })}
														</dd>
													) : null}
												</div>
											) : null}
										</dl>
										<ul className="mt-5 flex-1 space-y-2.5">
											{includes(group.family).map((line) => (
												<li
													key={line}
													className="flex items-start gap-2.5 text-sm text-muted-foreground"
												>
													<Check
														className="mt-0.5 h-4 w-4 shrink-0 text-success"
														aria-hidden="true"
													/>
													{line}
												</li>
											))}
										</ul>
										<div className="mt-5 grid gap-2">
											{[month, year].map((card) =>
												card ? (
													<SubscribeButton
														key={card.id}
														planId={card.id}
														currency={card.currency}
														locale={locale}
														signedIn={Boolean(user)}
														subscribed={Boolean(access?.entitled)}
														label={`${t('subscribe')} · ${card.interval === 'year' ? t('yearly') : t('monthly')}`}
													/>
												) : null,
											)}
										</div>
									</li>
								)
							})}
						</ul>
						<p className="mt-6 max-w-3xl text-xs leading-relaxed text-muted-foreground">
							{t('legal', { days: cancellationDays })}{' '}
							<Link href="/terms#subscriptions" className="underline">
								{t('manage')}
							</Link>
						</p>
					</>
				)}
			</MarketingSection>
		</main>
	)
}
