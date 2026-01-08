'use client'

import { CheckCircle, Copy, Gift, Share2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@sylphx/ui'

type ReferralCardProps = {
	referralCode: string
	onGenerate?: () => Promise<void>
	className?: string
}

export function ReferralCard({ referralCode, onGenerate, className }: ReferralCardProps) {
	const t = useTranslations('referrals')
	const [copied, setCopied] = useState(false)
	const [isGenerating, setIsGenerating] = useState(false)
	// Use empty string for SSR, update with actual URL on client to avoid hydration mismatch
	const [referralUrl, setReferralUrl] = useState('')

	useEffect(() => {
		if (referralCode) {
			setReferralUrl(`${window.location.origin}/sign-up?ref=${referralCode}`)
		}
	}, [referralCode])

	const handleCopy = async () => {
		await navigator.clipboard.writeText(referralUrl)
		setCopied(true)
		setTimeout(() => setCopied(false), 2000)
	}

	const handleShare = async () => {
		if (navigator.share) {
			try {
				await navigator.share({
					title: t('shareTitle'),
					text: t('shareText'),
					url: referralUrl,
				})
			} catch {
				// User cancelled share dialog - silently ignore
			}
		} else {
			// Fallback to copy
			handleCopy()
		}
	}

	const handleGenerate = async () => {
		if (!onGenerate) return
		setIsGenerating(true)
		try {
			await onGenerate()
		} finally {
			setIsGenerating(false)
		}
	}

	if (!referralCode) {
		return (
			<Card className={cn('overflow-hidden', className)}>
				<CardHeader className="bg-gradient-to-r from-purple-500/10 to-pink-500/10">
					<div className="flex items-center gap-3">
						<div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-500/20">
							<Gift className="h-6 w-6 text-purple-500" />
						</div>
						<div>
							<CardTitle>{t('getStarted')}</CardTitle>
							<CardDescription>{t('generateCodeDescription')}</CardDescription>
						</div>
					</div>
				</CardHeader>
				<CardContent className="p-6">
					<button
						type="button"
						onClick={handleGenerate}
						disabled={isGenerating}
						className={cn(
							'w-full rounded-lg bg-primary px-4 py-3 font-medium text-primary-foreground transition-colors',
							'hover:bg-primary/90 disabled:opacity-50',
						)}
					>
						{isGenerating ? t('generating') : t('generateCode')}
					</button>
				</CardContent>
			</Card>
		)
	}

	return (
		<Card className={cn('overflow-hidden', className)}>
			<CardHeader className="bg-gradient-to-r from-purple-500/10 to-pink-500/10">
				<div className="flex items-center gap-3">
					<div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-500/20">
						<Gift className="h-6 w-6 text-purple-500" />
					</div>
					<div>
						<CardTitle>{t('yourReferralCode')}</CardTitle>
						<CardDescription>{t('shareWithFriends')}</CardDescription>
					</div>
				</div>
			</CardHeader>

			<CardContent className="space-y-4 p-6">
				{/* Referral Code Display */}
				<div className="rounded-lg border-2 border-dashed border-purple-300 bg-purple-50 p-4 dark:border-purple-700 dark:bg-purple-950/30">
					<p className="text-center text-2xl font-bold tracking-wider text-purple-600 dark:text-purple-400">
						{referralCode}
					</p>
				</div>

				{/* Referral URL */}
				<div className="space-y-2">
					<label htmlFor="referral-url" className="text-sm font-medium text-muted-foreground">
						{t('referralLink')}
					</label>
					<div className="flex gap-2">
						<input
							id="referral-url"
							type="text"
							readOnly
							value={referralUrl}
							className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm"
						/>
					</div>
				</div>

				{/* Action Buttons */}
				<div className="grid grid-cols-2 gap-3">
					<button
						type="button"
						onClick={handleCopy}
						className={cn(
							'flex items-center justify-center gap-2 rounded-lg border px-4 py-3 font-medium transition-colors',
							copied
								? 'border-green-500 bg-green-50 text-green-700 dark:bg-green-950/30'
								: 'border-border bg-background hover:bg-muted',
						)}
					>
						{copied ? (
							<>
								<CheckCircle className="h-4 w-4" />
								{t('copied')}
							</>
						) : (
							<>
								<Copy className="h-4 w-4" />
								{t('copy')}
							</>
						)}
					</button>

					<button
						type="button"
						onClick={handleShare}
						className="flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-3 font-medium transition-colors hover:bg-muted"
					>
						<Share2 className="h-4 w-4" />
						{t('share')}
					</button>
				</div>

				{/* Reward Info */}
				<div className="rounded-lg bg-muted/50 p-4">
					<p className="text-sm text-muted-foreground">{t('rewardInfo')}</p>
				</div>
			</CardContent>
		</Card>
	)
}
