'use client'

import { Clock, UserCheck, Users } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@sylphx/ui'

type ReferralStatsProps = {
	totalReferrals: number
	completedReferrals: number
	pendingReferrals: number
	referrals?: Array<{
		id: string
		status: string
		rewardType: string
		createdAt: Date
		completedAt: Date | null
		referredUser?: { name: string | null; email: string }
	}>
	className?: string
}

export function ReferralStats({
	totalReferrals,
	completedReferrals,
	pendingReferrals,
	referrals = [],
	className,
}: ReferralStatsProps) {
	const t = useTranslations('referrals')
	const locale = useLocale()

	const stats = [
		{
			label: t('totalReferrals'),
			value: totalReferrals,
			icon: Users,
			color: 'text-blue-600',
			bgColor: 'bg-blue-500/10',
		},
		{
			label: t('completed'),
			value: completedReferrals,
			icon: UserCheck,
			color: 'text-green-600',
			bgColor: 'bg-green-500/10',
		},
		{
			label: t('pending'),
			value: pendingReferrals,
			icon: Clock,
			color: 'text-orange-600',
			bgColor: 'bg-orange-500/10',
		},
	]

	return (
		<Card className={cn('overflow-hidden', className)}>
			<CardHeader>
				<CardTitle>{t('yourReferrals')}</CardTitle>
				<CardDescription>{t('referralProgress')}</CardDescription>
			</CardHeader>

			<CardContent className="space-y-6">
				{/* Stats Grid */}
				<div className="grid grid-cols-3 gap-4">
					{stats.map((stat) => {
						const Icon = stat.icon
						return (
							<div
								key={stat.label}
								className="flex flex-col items-center gap-2 rounded-lg border bg-card p-4 text-center"
							>
								<div
									className={cn(
										'flex h-10 w-10 items-center justify-center rounded-full',
										stat.bgColor,
									)}
								>
									<Icon className={cn('h-5 w-5', stat.color)} />
								</div>
								<div>
									<p className="text-2xl font-bold">{stat.value}</p>
									<p className="text-xs text-muted-foreground">{stat.label}</p>
								</div>
							</div>
						)
					})}
				</div>

				{/* Referral List */}
				{referrals.length > 0 ? (
					<div className="space-y-2">
						<h4 className="text-sm font-medium text-muted-foreground">{t('recentReferrals')}</h4>
						<div className="space-y-2">
							{referrals.slice(0, 5).map((referral) => (
								<div
									key={referral.id}
									className="flex items-center justify-between rounded-lg border bg-card p-3"
								>
									<div className="flex-1">
										<p className="font-medium">
											{referral.referredUser?.name ||
												referral.referredUser?.email ||
												t('pendingUser')}
										</p>
										<p className="text-xs text-muted-foreground">
											{new Date(referral.createdAt).toLocaleDateString(locale)}
										</p>
									</div>
									<div className="flex items-center gap-2">
										<span
											className={cn(
												'rounded-full px-2 py-1 text-xs font-medium',
												referral.status === 'completed'
													? 'bg-green-500/10 text-green-600'
													: referral.status === 'pending'
														? 'bg-orange-500/10 text-orange-600'
														: 'bg-gray-500/10 text-gray-600',
											)}
										>
											{t(referral.status as 'completed' | 'pending' | 'expired')}
										</span>
									</div>
								</div>
							))}
						</div>
						{referrals.length > 5 && (
							<p className="text-center text-xs text-muted-foreground">
								{t('andMore', { count: referrals.length - 5 })}
							</p>
						)}
					</div>
				) : (
					<div className="rounded-lg bg-muted/50 p-6 text-center">
						<Users className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
						<p className="text-sm text-muted-foreground">{t('noReferralsYet')}</p>
					</div>
				)}
			</CardContent>
		</Card>
	)
}
