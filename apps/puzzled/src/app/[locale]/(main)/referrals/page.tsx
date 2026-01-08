'use client'

import { Gift } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { ReferralCard, ReferralStats } from '@/features/referral/components'
import { Header } from '@/shared/components/layout'
import { trpc } from '@/trpc/client'

export default function ReferralsPage() {
	const t = useTranslations()

	// Fetch referral code via tRPC
	const { data: codeData, refetch: refetchCode } = trpc.referrals.getCode.useQuery()

	// Fetch referral stats via tRPC
	const { data: statsData, isLoading, error } = trpc.referrals.getStats.useQuery()

	// Generate referral code mutation
	const generateMutation = trpc.referrals.generate.useMutation({
		onSuccess: () => {
			refetchCode()
		},
	})

	const handleGenerateCode = async () => {
		await generateMutation.mutateAsync()
	}

	if (isLoading) {
		return (
			<>
				<Header />
				<main className="flex flex-1 flex-col px-4 py-6">
					<div className="mx-auto w-full max-w-4xl">
						<div className="animate-pulse space-y-6">
							<div className="h-8 w-48 rounded bg-muted" />
							<div className="h-64 rounded-xl bg-muted" />
							<div className="h-96 rounded-xl bg-muted" />
						</div>
					</div>
				</main>
			</>
		)
	}

	if (error) {
		return (
			<>
				<Header />
				<main className="flex flex-1 flex-col px-4 py-6">
					<div className="mx-auto w-full max-w-4xl">
						<div className="rounded-lg border border-destructive bg-destructive/10 p-4">
							<p className="text-destructive">{error.message}</p>
						</div>
					</div>
				</main>
			</>
		)
	}

	return (
		<>
			<Header />
			<main className="flex flex-1 flex-col px-4 py-6">
				<div className="mx-auto w-full max-w-4xl space-y-6">
					{/* Page Header */}
					<div className="flex items-center gap-3">
						<div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-500/10">
							<Gift className="h-6 w-6 text-purple-500" />
						</div>
						<div>
							<h1 className="text-2xl font-bold">{t('referrals.title')}</h1>
							<p className="text-muted-foreground">{t('referrals.description')}</p>
						</div>
					</div>

					{/* Referral Code Card */}
					<ReferralCard referralCode={codeData?.code || ''} onGenerate={handleGenerateCode} />

					{/* Referral Stats */}
					{statsData && (
						<ReferralStats
							totalReferrals={statsData.totalReferrals}
							completedReferrals={statsData.completedReferrals}
							pendingReferrals={statsData.pendingReferrals}
							referrals={statsData.referrals}
						/>
					)}

					{/* How It Works */}
					<div className="rounded-lg border bg-card p-6">
						<h2 className="mb-4 text-lg font-semibold">{t('referrals.howItWorks')}</h2>
						<ol className="space-y-3 text-sm text-muted-foreground">
							<li className="flex gap-3">
								<span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 font-medium text-primary">
									1
								</span>
								<span>{t('referrals.step1')}</span>
							</li>
							<li className="flex gap-3">
								<span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 font-medium text-primary">
									2
								</span>
								<span>{t('referrals.step2')}</span>
							</li>
							<li className="flex gap-3">
								<span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 font-medium text-primary">
									3
								</span>
								<span>{t('referrals.step3')}</span>
							</li>
						</ol>
					</div>
				</div>
			</main>
		</>
	)
}
