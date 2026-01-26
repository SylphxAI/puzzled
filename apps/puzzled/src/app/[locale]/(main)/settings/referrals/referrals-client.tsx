'use client'

import { useReferral } from '@sylphx/sdk/react'
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@sylphx/ui'
import { Check, Clock, Copy, Gift, RefreshCw, Share2, UserCheck, Users } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

export function ReferralsContent() {
	const t = useTranslations('referrals')
	const { stats, code, link, isLoading, error, copyCode, copyLink, regenerateCode } = useReferral()
	const [copied, setCopied] = useState<'link' | 'code' | null>(null)
	const [isRegenerating, setIsRegenerating] = useState(false)

	const handleCopyLink = async () => {
		await copyLink()
		setCopied('link')
		setTimeout(() => setCopied(null), 2000)
	}

	const handleCopyCode = async () => {
		await copyCode()
		setCopied('code')
		setTimeout(() => setCopied(null), 2000)
	}

	const handleRegenerateCode = async () => {
		setIsRegenerating(true)
		try {
			await regenerateCode()
		} finally {
			setIsRegenerating(false)
		}
	}

	const handleShare = async () => {
		if (!link) return

		if (navigator.share) {
			try {
				await navigator.share({
					title: t('shareTitle'),
					text: t('shareText'),
					url: link,
				})
			} catch {
				// User cancelled or share failed
			}
		} else {
			// Fallback to copy link
			await handleCopyLink()
		}
	}

	if (isLoading) {
		return (
			<div className="space-y-6">
				<Card>
					<CardContent className="flex items-center justify-center py-12">
						<RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
					</CardContent>
				</Card>
			</div>
		)
	}

	return (
		<div className="space-y-6">
			{/* Header */}
			<div>
				<h2 className="text-xl font-semibold">{t('title')}</h2>
				<p className="text-sm text-muted-foreground">{t('description')}</p>
			</div>

			{/* Error State */}
			{error && (
				<Card className="border-destructive/50 bg-destructive/10">
					<CardContent className="py-4">
						<p className="text-sm text-destructive">{error.message}</p>
					</CardContent>
				</Card>
			)}

			{/* Referral Code Card */}
			<Card>
				<CardHeader>
					<CardTitle className="text-lg">{t('yourReferralCode')}</CardTitle>
					<CardDescription>{t('shareWithFriends')}</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					{/* Code Display */}
					{code ? (
						<div className="flex items-center gap-2">
							<div className="flex-1 rounded-lg bg-muted px-4 py-3 font-mono text-lg font-semibold tracking-wider text-center">
								{code}
							</div>
							<Button variant="outline" size="icon" onClick={handleCopyCode} className="shrink-0">
								{copied === 'code' ? (
									<Check className="h-4 w-4 text-green-500" />
								) : (
									<Copy className="h-4 w-4" />
								)}
							</Button>
							<Button
								variant="outline"
								size="icon"
								onClick={handleRegenerateCode}
								disabled={isRegenerating}
								className="shrink-0"
							>
								<RefreshCw className={`h-4 w-4 ${isRegenerating ? 'animate-spin' : ''}`} />
							</Button>
						</div>
					) : (
						<div className="space-y-3">
							<p className="text-sm text-muted-foreground">{t('generateCodeDescription')}</p>
							<Button onClick={handleRegenerateCode} disabled={isRegenerating}>
								{isRegenerating ? (
									<>
										<RefreshCw className="mr-2 h-4 w-4 animate-spin" />
										{t('generating')}
									</>
								) : (
									t('generateCode')
								)}
							</Button>
						</div>
					)}

					{/* Link Display */}
					{link && (
						<div className="space-y-2">
							<label className="text-sm font-medium">{t('referralLink')}</label>
							<div className="flex items-center gap-2">
								<input
									type="text"
									value={link}
									readOnly
									className="flex-1 rounded-lg border bg-muted px-3 py-2 text-sm"
								/>
								<Button variant="outline" size="sm" onClick={handleCopyLink} className="shrink-0">
									{copied === 'link' ? (
										<>
											<Check className="mr-2 h-4 w-4 text-green-500" />
											{t('copied')}
										</>
									) : (
										<>
											<Copy className="mr-2 h-4 w-4" />
											{t('copy')}
										</>
									)}
								</Button>
								<Button variant="default" size="sm" onClick={handleShare} className="shrink-0">
									<Share2 className="mr-2 h-4 w-4" />
									{t('share')}
								</Button>
							</div>
						</div>
					)}

					{/* Reward Info */}
					<div className="flex items-center gap-3 rounded-lg bg-primary/10 p-4">
						<Gift className="h-5 w-5 shrink-0 text-primary" />
						<p className="text-sm">{t('rewardInfo')}</p>
					</div>
				</CardContent>
			</Card>

			{/* Stats Card */}
			<Card>
				<CardHeader>
					<CardTitle className="text-lg">{t('yourReferrals')}</CardTitle>
					<CardDescription>{t('referralProgress')}</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-3 gap-4">
						<div className="flex flex-col items-center rounded-lg bg-muted p-4">
							<Users className="mb-2 h-5 w-5 text-muted-foreground" />
							<span className="text-2xl font-bold">{stats?.totalReferrals ?? 0}</span>
							<span className="text-xs text-muted-foreground">{t('totalReferrals')}</span>
						</div>
						<div className="flex flex-col items-center rounded-lg bg-muted p-4">
							<UserCheck className="mb-2 h-5 w-5 text-green-500" />
							<span className="text-2xl font-bold text-green-500">
								{stats?.completedReferrals ?? 0}
							</span>
							<span className="text-xs text-muted-foreground">{t('completed')}</span>
						</div>
						<div className="flex flex-col items-center rounded-lg bg-muted p-4">
							<Clock className="mb-2 h-5 w-5 text-yellow-500" />
							<span className="text-2xl font-bold text-yellow-500">
								{stats?.pendingReferrals ?? 0}
							</span>
							<span className="text-xs text-muted-foreground">{t('pending')}</span>
						</div>
					</div>

					{stats?.totalReferrals === 0 && (
						<p className="mt-4 text-center text-sm text-muted-foreground">{t('noReferralsYet')}</p>
					)}
				</CardContent>
			</Card>

			{/* How It Works */}
			<Card>
				<CardHeader>
					<CardTitle className="text-lg">{t('howItWorks')}</CardTitle>
				</CardHeader>
				<CardContent>
					<ol className="space-y-3">
						<li className="flex items-start gap-3">
							<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
								1
							</span>
							<span className="text-sm">{t('step1')}</span>
						</li>
						<li className="flex items-start gap-3">
							<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
								2
							</span>
							<span className="text-sm">{t('step2')}</span>
						</li>
						<li className="flex items-start gap-3">
							<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
								3
							</span>
							<span className="text-sm">{t('step3')}</span>
						</li>
					</ol>
				</CardContent>
			</Card>
		</div>
	)
}
