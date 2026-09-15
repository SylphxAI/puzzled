'use client'

import { Button } from '@sylphx/ui'
import { Check, CreditCard, Sparkles } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import {
	ConsoleCard,
	ConsoleHeader,
	HonestNotice,
} from '@/features/console/components/console-chrome'
import { Link } from '@/lib/i18n/routing'
import { useBilling } from '@/lib/identity/react'

/**
 * Plan section.
 *
 * The server decided whether the plan is premium, free, or unreadable; this
 * section states that verdict and offers the two real actions — open the billing
 * portal, or look at the plans.
 */
export function SubscriptionSettingsContent({ premium }: { premium: boolean | null }) {
	const t = useTranslations('subscription')
	const tSettings = useTranslations('settings')
	const { openPortal } = useBilling()
	const [pending, setPending] = useState(false)
	const [error, setError] = useState<string | null>(null)

	async function handleManage() {
		setPending(true)
		setError(null)
		try {
			await openPortal()
		} catch {
			setError(t('portalError'))
		} finally {
			setPending(false)
		}
	}

	const premiumFeatures = [
		t('benefits.everyModule'),
		t('benefits.archive'),
		t('benefits.stats'),
		t('benefits.freezes'),
	]
	const freeFeatures = [t('benefits.freeModule'), t('benefits.streak'), t('benefits.boards')]

	return (
		<>
			<ConsoleHeader
				headingLevel={2}
				title={tSettings('subscription.title')}
				description={tSettings('subscription.description')}
			/>

			{premium === null ? (
				<ConsoleCard title={t('planTitle')} description={t('planDescription')}>
					<HonestNotice
						title={t('unknown.title')}
						body={t('unknown.body')}
						action={{ href: '/settings/subscription', label: t('unknown.retry') }}
					/>
				</ConsoleCard>
			) : (
				<ConsoleCard
					title={t('planTitle')}
					description={t('planDescription')}
					actions={
						premium ? (
							<Button onClick={handleManage} disabled={pending} className="min-h-11 gap-2">
								<CreditCard className="h-4 w-4" aria-hidden="true" />
								{pending ? t('managing') : t('manage')}
							</Button>
						) : (
							<Button asChild className="min-h-11 gap-2">
								<Link href="/pricing">
									<Sparkles className="h-4 w-4" aria-hidden="true" />
									{t('upgrade')}
								</Link>
							</Button>
						)
					}
				>
					<p className="font-display text-xl font-extrabold">
						{premium ? t('premiumPlan') : t('freePlan')}
					</p>
					<p className="mt-1 text-sm leading-relaxed text-muted-foreground">
						{premium ? t('premiumDescription') : t('freeDescription')}
					</p>

					<h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
						{t('included')}
					</h3>
					<ul className="mt-2 space-y-2 text-sm">
						{(premium ? premiumFeatures : freeFeatures).map((feature) => (
							<li key={feature} className="flex items-start gap-2">
								<Check
									className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"
									aria-hidden="true"
								/>
								<span>{feature}</span>
							</li>
						))}
					</ul>

					<output aria-live="polite" className="block">
						{error ? (
							<p className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
								{error} {t('portalErrorDescription')}
							</p>
						) : null}
					</output>

					{premium ? (
						<p className="mt-4 text-xs leading-relaxed text-muted-foreground">{t('portalNote')}</p>
					) : null}
				</ConsoleCard>
			)}
		</>
	)
}
