'use client'

import { Button } from '@sylphx/ui'
import { Check, Copy, Gift, RefreshCw, Share2, UserCheck, Users } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { ConsoleCard, HonestNotice } from '@/features/console/components/console-chrome'
import { useReferral } from '@/lib/identity/react'

/**
 * Referral section.
 *
 * Every number here is what the referral read returned. While it is loading the
 * panel says so, and if it fails the panel says that instead of showing zeros
 * for a code the account may well have.
 */
export function ReferralsContent() {
	const t = useTranslations('referrals')
	const { stats, code, link, isLoading, error, copyCode, copyLink, regenerateCode } = useReferral()
	const [copied, setCopied] = useState<'link' | 'code' | null>(null)
	const [isRegenerating, setIsRegenerating] = useState(false)

	async function handleCopyLink() {
		await copyLink()
		setCopied('link')
	}

	async function handleCopyCode() {
		await copyCode()
		setCopied('code')
	}

	async function handleRegenerateCode() {
		setIsRegenerating(true)
		try {
			await regenerateCode()
		} finally {
			setIsRegenerating(false)
		}
	}

	async function handleShare() {
		if (!link) return
		if (typeof navigator !== 'undefined' && navigator.share) {
			try {
				await navigator.share({ title: t('shareTitle'), text: t('shareText'), url: link })
				return
			} catch {
				// The share sheet was dismissed; fall through to copying.
			}
		}
		await handleCopyLink()
	}

	if (isLoading) {
		return (
			<ConsoleCard title={t('yourReferralCode')} description={t('shareWithFriends')}>
				<output aria-live="polite" className="block text-sm text-muted-foreground">
					{t('loading')}
				</output>
			</ConsoleCard>
		)
	}

	if (error) {
		return (
			<ConsoleCard title={t('yourReferralCode')} description={t('shareWithFriends')}>
				<HonestNotice
					title={t('unavailableTitle')}
					body={t('unavailableBody')}
					action={{ href: '/settings/referrals', label: t('retry') }}
				/>
			</ConsoleCard>
		)
	}

	return (
		<>
			<ConsoleCard title={t('yourReferralCode')} description={t('shareWithFriends')}>
				{code ? (
					<div className="space-y-4">
						<div className="flex flex-wrap items-center gap-2">
							<p className="min-h-11 flex-1 rounded-xl bg-surface-muted px-4 py-3 text-center font-mono text-lg font-semibold tracking-wider">
								{code}
							</p>
							<Button
								variant="outline"
								onClick={handleCopyCode}
								className="min-h-11 gap-2"
								aria-label={t('copy')}
							>
								{copied === 'code' ? (
									<Check
										className="h-4 w-4 text-emerald-600 dark:text-emerald-400"
										aria-hidden="true"
									/>
								) : (
									<Copy className="h-4 w-4" aria-hidden="true" />
								)}
								{t('copy')}
							</Button>
							<Button
								variant="outline"
								onClick={handleRegenerateCode}
								disabled={isRegenerating}
								className="min-h-11 gap-2"
							>
								<RefreshCw
									className={isRegenerating ? 'h-4 w-4 animate-spin' : 'h-4 w-4'}
									aria-hidden="true"
								/>
								{t('regenerate')}
							</Button>
						</div>

						<div className="space-y-2">
							<label htmlFor="referral-link" className="block text-sm font-semibold">
								{t('referralLink')}
							</label>
							<div className="flex flex-wrap items-center gap-2">
								<input
									id="referral-link"
									type="text"
									value={link}
									readOnly
									className="min-h-11 flex-1 rounded-xl border border-border bg-surface-muted px-3 text-sm"
								/>
								<Button variant="outline" onClick={handleCopyLink} className="min-h-11 gap-2">
									<Copy className="h-4 w-4" aria-hidden="true" />
									{t('copy')}
								</Button>
								<Button onClick={handleShare} className="min-h-11 gap-2">
									<Share2 className="h-4 w-4" aria-hidden="true" />
									{t('share')}
								</Button>
							</div>
						</div>

						<output
							aria-live="polite"
							className="block text-sm font-semibold text-emerald-700 dark:text-emerald-400"
						>
							{copied ? t('copied') : ''}
						</output>
					</div>
				) : (
					<div className="space-y-3">
						<p className="text-sm text-muted-foreground">{t('generateCodeDescription')}</p>
						<Button
							onClick={handleRegenerateCode}
							disabled={isRegenerating}
							className="min-h-11 gap-2"
						>
							{isRegenerating ? (
								<RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
							) : (
								<Gift className="h-4 w-4" aria-hidden="true" />
							)}
							{isRegenerating ? t('generating') : t('generateCode')}
						</Button>
					</div>
				)}

				<p className="mt-4 flex items-start gap-2 rounded-xl bg-primary/10 p-3 text-sm">
					<Gift className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
					{t('rewardInfo')}
				</p>
			</ConsoleCard>

			<ConsoleCard title={t('yourReferrals')} description={t('referralProgress')}>
				<dl className="grid grid-cols-3 gap-3 text-center">
					<div className="rounded-2xl border border-border/70 bg-surface-muted/60 p-3">
						<dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
							{t('totalReferrals')}
						</dt>
						<dd className="mt-1 flex flex-col items-center font-display text-2xl font-extrabold tnum">
							<Users className="mb-1 h-4 w-4 text-muted-foreground" aria-hidden="true" />
							{stats.totalReferrals}
						</dd>
					</div>
					<div className="rounded-2xl border border-border/70 bg-surface-muted/60 p-3">
						<dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
							{t('completed')}
						</dt>
						<dd className="mt-1 flex flex-col items-center font-display text-2xl font-extrabold tnum">
							<UserCheck
								className="mb-1 h-4 w-4 text-emerald-600 dark:text-emerald-400"
								aria-hidden="true"
							/>
							{stats.completedReferrals}
						</dd>
					</div>
					<div className="rounded-2xl border border-border/70 bg-surface-muted/60 p-3">
						<dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
							{t('pending')}
						</dt>
						<dd className="mt-1 font-display text-2xl font-extrabold tnum">
							{stats.pendingReferrals}
						</dd>
					</div>
				</dl>
				{stats.totalReferrals === 0 ? (
					<p className="mt-3 text-sm text-muted-foreground">{t('noReferralsYet')}</p>
				) : null}
			</ConsoleCard>

			<ConsoleCard title={t('howItWorks')}>
				<ol className="space-y-3">
					{[t('step1'), t('step2'), t('step3')].map((step, index) => (
						<li key={step} className="flex items-start gap-3">
							<span
								className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground"
								aria-hidden="true"
							>
								{index + 1}
							</span>
							<span className="text-sm">{step}</span>
						</li>
					))}
				</ol>
			</ConsoleCard>
		</>
	)
}
