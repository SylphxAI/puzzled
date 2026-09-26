'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@sylphx/ui'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import type { SubscriptionView } from '@/lib/billing/plus'
import {
	cancelSubscription,
	leaveFamily,
	openPortal,
	removeFamilyMember,
	resetFamilyInvite,
	resumeSubscription,
} from '@/lib/connect/billing-client'
import { Link, useRouter } from '@/lib/i18n/routing'
import { logger } from '@/lib/logger'

type Props = {
	view: SubscriptionView | null
	locale: string
	fromCheckout: boolean
}

const primary =
	'inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-60'
const secondary =
	'inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-4 text-sm font-semibold hover:border-primary/30 hover:text-primary disabled:opacity-60'

/** Plan state, cancel/resume, the Stripe portal, and the family plan. */
export function SubscriptionPanel({ view, locale, fromCheckout }: Props) {
	const t = useTranslations('plus.subscription')
	const tFamily = useTranslations('plus.family')
	const tUnlock = useTranslations('plus.unlock')
	const router = useRouter()
	const [busy, setBusy] = useState(false)
	const [confirming, setConfirming] = useState<'cancel' | 'leave' | null>(null)
	const [message, setMessage] = useState<string | null>(
		fromCheckout && view?.entitled ? t('checkoutSuccess') : null,
	)
	const [inviteCode, setInviteCode] = useState(view?.family?.inviteCode ?? null)
	const [copied, setCopied] = useState(false)

	const date = (ms: number | null) =>
		ms ? new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(new Date(ms)) : ''

	async function run(action: () => Promise<string | null>) {
		setBusy(true)
		setMessage(null)
		try {
			setMessage(await action())
			setConfirming(null)
			router.refresh()
		} catch (error) {
			logger.error('plus.settings-action-failed', { error })
			const text = error instanceof Error ? error.message : ''
			const code = Object.keys(tFamily.raw('errors') as Record<string, string>).find((c) =>
				text.includes(c),
			)
			setMessage(code ? tFamily(`errors.${code}`) : t('error'))
		} finally {
			setBusy(false)
		}
	}

	if (!view) {
		return <p role="alert">{t('error')}</p>
	}

	const own = view.source === 'plus'
	const origin = typeof window === 'undefined' ? '' : window.location.origin
	const inviteUrl = inviteCode ? `${origin}/family/join?code=${inviteCode}` : null
	const refundOpen = own && view.refundUntilMs !== null && !view.cancelAtPeriodEnd
	const statusKey =
		view.status === 'trialing'
			? 'active'
			: ['active', 'past_due', 'canceled'].includes(view.status ?? '')
				? (view.status as string)
				: 'other'

	return (
		<div className="space-y-6">
			{message ? (
				<output className="block rounded-xl bg-muted px-4 py-3 text-sm">{message}</output>
			) : null}

			<Card>
				<CardHeader>
					<CardTitle>{t('title')}</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4 text-sm">
					{!view.salesOpen ? (
						<p>{t('closed')}</p>
					) : view.source === 'none' ? (
						<>
							<p>{t('free')}</p>
							<Link href="/pricing" className={primary}>
								{tUnlock('cta')}
							</Link>
						</>
					) : view.source === 'family' ? (
						<p>{t('viaFamily')}</p>
					) : (
						<>
							<p className="font-display text-lg font-bold">
								{view.planId ? t(`plan.${view.planId}`) : null}
							</p>
							<p>{t(`status.${statusKey}`)}</p>
							<p className="text-muted-foreground">
								{view.cancelAtPeriodEnd
									? t('ends', { date: date(view.periodEndMs) })
									: t('renews', { date: date(view.periodEndMs) })}
							</p>
							{refundOpen ? (
								<p className="text-muted-foreground">
									{t('refundWindow', { date: date(view.refundUntilMs) })}
								</p>
							) : null}

							{confirming === 'cancel' ? (
								<div className="space-y-3 rounded-xl border border-border p-4">
									<p>
										{refundOpen
											? t('cancelRefundConfirm')
											: t('cancelPeriodConfirm', { date: date(view.periodEndMs) })}
									</p>
									<div className="flex flex-wrap gap-2">
										<button
											type="button"
											className={primary}
											disabled={busy}
											onClick={() =>
												run(async () => {
													const done = await cancelSubscription()
													return done.refunded
														? t('cancelledRefund')
														: t('cancelledPeriod', { date: date(done.accessEndsAtMs) })
												})
											}
										>
											{t('cancel')}
										</button>
										<button type="button" className={secondary} onClick={() => setConfirming(null)}>
											{t('resume')}
										</button>
									</div>
								</div>
							) : (
								<div className="flex flex-wrap gap-2">
									<button
										type="button"
										className={secondary}
										disabled={busy}
										onClick={() =>
											run(async () => {
												window.location.assign(await openPortal(locale))
												return null
											})
										}
									>
										{t('manage')}
									</button>
									{view.cancelAtPeriodEnd ? (
										<button
											type="button"
											className={primary}
											disabled={busy}
											onClick={() =>
												run(async () => {
													await resumeSubscription()
													return t('resumed')
												})
											}
										>
											{t('resume')}
										</button>
									) : (
										<button
											type="button"
											className={secondary}
											disabled={busy}
											onClick={() => setConfirming('cancel')}
										>
											{t('cancel')}
										</button>
									)}
								</div>
							)}
						</>
					)}
				</CardContent>
			</Card>

			{view.family ? (
				<Card>
					<CardHeader>
						<CardTitle>{tFamily('title')}</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4 text-sm">
						{view.family.role === 'owner' && inviteUrl ? (
							<div className="space-y-2">
								<p>{tFamily('inviteBody', { count: view.family.maxMembers })}</p>
								<p className="break-all rounded-lg bg-muted px-3 py-2 font-mono text-xs">
									{inviteUrl}
								</p>
								<div className="flex flex-wrap gap-2">
									<button
										type="button"
										className={secondary}
										onClick={async () => {
											await navigator.clipboard.writeText(inviteUrl)
											setCopied(true)
										}}
									>
										{copied ? tFamily('copied') : tFamily('copy')}
									</button>
									<button
										type="button"
										className={secondary}
										disabled={busy}
										title={tFamily('newLinkHelp')}
										onClick={() =>
											run(async () => {
												setInviteCode(await resetFamilyInvite())
												setCopied(false)
												return tFamily('newLinkHelp')
											})
										}
									>
										{tFamily('newLink')}
									</button>
								</div>
							</div>
						) : null}

						<div>
							<h3 className="font-semibold">{tFamily('members')}</h3>
							<ul className="mt-2 divide-y divide-border">
								{view.family.members.map((member) => (
									<li
										key={member.userId}
										className="flex min-h-11 items-center justify-between gap-3"
									>
										<span>
											{member.displayName || tFamily('unnamed')}
											{member.owner ? (
												<span className="ml-2 text-muted-foreground">{tFamily('owner')}</span>
											) : null}
										</span>
										{view.family?.role === 'owner' && !member.owner ? (
											<button
												type="button"
												className={secondary}
												disabled={busy}
												onClick={() =>
													run(async () => {
														await removeFamilyMember(member.userId)
														return null
													})
												}
											>
												{tFamily('remove')}
											</button>
										) : null}
									</li>
								))}
							</ul>
						</div>

						{view.family.role === 'member' ? (
							confirming === 'leave' ? (
								<div className="space-y-3 rounded-xl border border-border p-4">
									<p>{tFamily('leaveConfirm')}</p>
									<button
										type="button"
										className={primary}
										disabled={busy}
										onClick={() =>
											run(async () => {
												await leaveFamily()
												return null
											})
										}
									>
										{tFamily('leave')}
									</button>
								</div>
							) : (
								<button type="button" className={secondary} onClick={() => setConfirming('leave')}>
									{tFamily('leave')}
								</button>
							)
						) : null}
					</CardContent>
				</Card>
			) : null}
		</div>
	)
}
