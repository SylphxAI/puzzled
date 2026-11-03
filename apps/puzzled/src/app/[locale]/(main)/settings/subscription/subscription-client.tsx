'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@sylphx/ui'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import { TrialEndingBanner } from '@/features/plus/components/trial-ending-banner'
import type { SubscriptionView } from '@/lib/billing/plus'
import { checkoutConfirmed, trialBannerEndMs } from '@/lib/billing/plus'
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
import { useClipboardCopy } from '@/shared/hooks/use-clipboard-copy'

type Props = {
	view: SubscriptionView | null
	locale: string
	fromCheckout: boolean
}

const primary =
	'inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-60'
const secondary =
	'inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-4 text-sm font-semibold hover:border-primary/30 hover:text-primary disabled:opacity-60'

/** Plan state, cancel/resume, the billing portal, and the family plan. */
export function SubscriptionPanel({ view, locale, fromCheckout }: Props) {
	const t = useTranslations('plus.subscription')
	const tFamily = useTranslations('plus.family')
	const tUnlock = useTranslations('plus.unlock')
	const tTrial = useTranslations('plus.trial')
	const tCopy = useTranslations('common.clipboard')
	const router = useRouter()
	const [busy, setBusy] = useState(false)
	const [confirming, setConfirming] = useState<'cancel' | 'leave' | null>(null)
	const [message, setMessage] = useState<string | null>(null)
	const confirmed = checkoutConfirmed(view)
	// The processor may confirm just after the redirect. Re-read the server's
	// Money answer for a bounded period; neither the URL nor polling grants Plus.
	useEffect(() => {
		if (!fromCheckout || confirmed) return
		let attempts = 0
		const timer = setInterval(() => {
			router.refresh()
			if (++attempts >= 15) clearInterval(timer)
		}, 2000)
		return () => clearInterval(timer)
	}, [fromCheckout, confirmed, router])
	const notice =
		message ?? (fromCheckout ? t(confirmed ? 'checkoutSuccess' : 'checkoutPending') : null)
	const [newInviteCode, setInviteCode] = useState<string | null>(null)
	const inviteCode = newInviteCode ?? view?.family?.inviteCode ?? null
	const origin = typeof window === 'undefined' ? '' : window.location.origin
	const inviteUrl = inviteCode ? `${origin}/family/join?code=${inviteCode}` : null
	const inviteRef = useRef<HTMLParagraphElement>(null)
	const { status: copyStatus, copy } = useClipboardCopy(inviteUrl ?? '', inviteRef)
	const [nowMs] = useState(() => Date.now())

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

	const statusKey =
		view.status === 'trialing'
			? 'active'
			: ['active', 'past_due', 'canceled'].includes(view.status ?? '')
				? (view.status as string)
				: 'other'

	const trialEndMs = trialBannerEndMs(view, nowMs)

	return (
		<div className="space-y-6">
			{trialEndMs ? <TrialEndingBanner endMs={trialEndMs} /> : null}
			{notice ? (
				<output className="block rounded-xl bg-muted px-4 py-3 text-sm">{notice}</output>
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
					) : view.source === 'trial' ? (
						<>
							<p>{tTrial('endsOn', { date: date(view.trialEndsMs) })}</p>
							<Link href="/pricing" className={primary}>
								{tUnlock('cta')}
							</Link>
						</>
					) : (
						<>
							<p className="font-display text-lg">
								{view.planId ? t(`plan.${view.planId}`) : null}
							</p>
							<p>{t(`status.${statusKey}`)}</p>
							<p className="text-muted-foreground">
								{view.cancelAtPeriodEnd
									? t('ends', { date: date(view.periodEndMs) })
									: t('renews', { date: date(view.periodEndMs) })}
							</p>

							{confirming === 'cancel' ? (
								<div className="space-y-3 rounded-xl border border-border p-4">
									<p>{t('cancelPeriodConfirm', { date: date(view.periodEndMs) })}</p>
									<div className="flex flex-wrap gap-2">
										<button
											type="button"
											className={primary}
											disabled={busy}
											onClick={() =>
												run(async () => {
													const done = await cancelSubscription()
													return t('cancelledPeriod', { date: date(done.accessEndsAtMs) })
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
								<p
									ref={inviteRef}
									tabIndex={-1}
									className="select-all break-all rounded-lg bg-muted px-3 py-2 font-mono text-xs"
								>
									{inviteUrl}
								</p>
								<div className="flex flex-wrap gap-2">
									<button
										type="button"
										className={secondary}
										onClick={copy}
										disabled={copyStatus === 'pending'}
										aria-busy={copyStatus === 'pending'}
									>
										<span aria-live="polite">
											{copyStatus === 'pending'
												? tCopy('pending')
												: copyStatus === 'copied'
													? tFamily('copied')
													: tFamily('copy')}
										</span>
									</button>
									<button
										type="button"
										className={secondary}
										disabled={busy}
										title={tFamily('newLinkHelp')}
										onClick={() =>
											run(async () => {
												setInviteCode(await resetFamilyInvite())
												return tFamily('newLinkHelp')
											})
										}
									>
										{tFamily('newLink')}
									</button>
								</div>
								{copyStatus === 'failed' && (
									<p role="alert" className="text-destructive">
										{tCopy('failed')}
									</p>
								)}
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
