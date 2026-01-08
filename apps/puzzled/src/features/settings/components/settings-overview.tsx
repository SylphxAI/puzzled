'use client'

import {
	ChevronRight,
	CreditCard,
	Crown,
	Edit3,
	ExternalLink,
	Flame,
	Gamepad2,
	Link2,
	Lock,
	Settings,
	Shield,
	ShieldCheck,
	Star,
	Target,
	Trophy,
	User,
} from 'lucide-react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { useSession } from '@/features/auth'
import { type Achievement, TIER_BG_COLORS, TIER_COLORS } from '@/features/gamification'
import { isPremiumPlan } from '@/features/subscription'
import { Link } from '@/lib/i18n/routing'
import { cn } from '@/lib/utils'
import { Badge, Icon, Progress, Skeleton } from '@/shared/components/ui'
import type { NotificationPreferences } from '../server'
import { QuickNotificationToggles } from './quick-notification-toggles'
import { SecurityScoreRing } from './security-score'

/**
 * Session user with additional fields configured in auth.ts
 */
type SessionUserWithAdditionalFields = {
	id: string
	name: string | null
	email: string
	image: string | null
	emailVerified: boolean
	createdAt: Date
	updatedAt: Date
	role?: string
	username?: string | null
	bio?: string | null
	isPublicProfile?: boolean
	twoFactorEnabled?: boolean
}

type SettingsOverviewProps = {
	stats?: {
		currentStreak: number
		maxStreak: number
		totalWins: number
		gamesPlayed: number
	}
	subscription?: {
		plan: 'free' | 'premium' | 'lifetime'
		currentPeriodEnd?: Date | null
	}
	securityScore?: number
	connectedAccounts?: number
	hasPlayedToday?: boolean
	notificationPreferences?: NotificationPreferences | null
	achievements?: Achievement[]
}

/**
 * Settings Overview Dashboard - Bento Grid Design
 *
 * A modern, game-inspired command center for user settings
 */
export function SettingsOverview({
	stats,
	subscription,
	securityScore = 0,
	connectedAccounts = 0,
	hasPlayedToday = false,
	notificationPreferences,
	achievements = [],
}: SettingsOverviewProps) {
	const t = useTranslations('settings.overview')
	const { data: session } = useSession()
	const user = session?.user

	const isPremium = subscription ? isPremiumPlan(subscription.plan) : false

	// Quick action cards
	const quickActions = [
		{
			id: 'identity',
			icon: User,
			label: t('sections.identity'),
			description: t('sections.identityDesc'),
			href: '/settings/profile',
			gradient: 'from-blue-500 to-indigo-600',
			iconBg: 'bg-blue-500/15',
			iconColor: 'text-blue-500',
		},
		{
			id: 'security',
			icon: Shield,
			label: t('sections.security'),
			description: t('sections.securityDesc'),
			href: '/settings/security',
			gradient: 'from-emerald-500 to-teal-600',
			iconBg: 'bg-emerald-500/15',
			iconColor: 'text-emerald-500',
			badge: securityScore === 100 ? 'verified' : securityScore < 50 ? 'warning' : undefined,
		},
		{
			id: 'account',
			icon: Link2,
			label: t('sections.account'),
			description: t('sections.accountDesc'),
			href: '/settings/account',
			gradient: 'from-orange-500 to-amber-600',
			iconBg: 'bg-orange-500/15',
			iconColor: 'text-orange-500',
			badge: connectedAccounts > 0 ? `${connectedAccounts}` : undefined,
		},
		{
			id: 'subscription',
			icon: CreditCard,
			label: t('sections.subscription'),
			description: t('sections.subscriptionDesc'),
			href: '/settings/subscription',
			gradient: 'from-amber-500 to-yellow-600',
			iconBg: 'bg-amber-500/15',
			iconColor: 'text-amber-500',
			badge: isPremium ? 'premium' : undefined,
		},
		{
			id: 'preferences',
			icon: Settings,
			label: t('sections.preferences'),
			description: t('sections.preferencesDesc'),
			href: '/settings/preferences',
			gradient: 'from-pink-500 to-rose-600',
			iconBg: 'bg-pink-500/15',
			iconColor: 'text-pink-500',
		},
		{
			id: 'privacy',
			icon: Lock,
			label: t('sections.privacy'),
			description: t('sections.privacyDesc'),
			href: '/settings/privacy',
			gradient: 'from-slate-500 to-slate-700',
			iconBg: 'bg-slate-500/15',
			iconColor: 'text-slate-500',
		},
	]

	if (!user) {
		return <OverviewSkeleton />
	}

	const displayName = user.name || (user as SessionUserWithAdditionalFields).username || 'Player'
	const username = (user as SessionUserWithAdditionalFields).username
	const initials = displayName.charAt(0).toUpperCase()
	const winRate =
		stats && stats.gamesPlayed > 0 ? Math.round((stats.totalWins / stats.gamesPlayed) * 100) : 0

	// Calculate player level based on games played
	const gamesPlayed = stats?.gamesPlayed ?? 0
	const level = Math.floor(Math.sqrt(gamesPlayed / 5)) + 1
	const currentLevelXP = gamesPlayed - (level - 1) ** 2 * 5
	const nextLevelXP = level ** 2 * 5 - (level - 1) ** 2 * 5
	const levelProgress = nextLevelXP > 0 ? (currentLevelXP / nextLevelXP) * 100 : 0

	return (
		<div className="space-y-6">
			{/* Hero Player Card */}
			<div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-card via-card to-muted/30 shadow-lg">
				{/* Animated gradient background */}
				<div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-purple-500/5" />

				{/* Geometric pattern overlay */}
				<div className="absolute inset-0 opacity-[0.02] dark:opacity-[0.04]">
					<svg
						className="h-full w-full"
						viewBox="0 0 60 60"
						preserveAspectRatio="xMidYMid slice"
						aria-hidden="true"
					>
						<defs>
							<pattern id="hex-pattern" width="30" height="26" patternUnits="userSpaceOnUse">
								<path
									d="M15 0 L30 7.5 L30 22.5 L15 26 L0 18.5 L0 7.5 Z"
									fill="none"
									stroke="currentColor"
									strokeWidth="0.5"
								/>
							</pattern>
						</defs>
						<rect width="100%" height="100%" fill="url(#hex-pattern)" />
					</svg>
				</div>

				{/* Gradient accent strip */}
				<div className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-primary via-purple-500 to-pink-500" />

				{/* Glow effects */}
				<div className="absolute -left-20 -top-20 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
				<div className="absolute -bottom-10 -right-10 h-32 w-32 rounded-full bg-purple-500/15 blur-3xl" />

				<div className="relative p-6 sm:p-8">
					<div className="flex flex-col gap-6 sm:flex-row sm:items-start">
						{/* Avatar Section */}
						<div className="relative flex-shrink-0">
							<div className="relative">
								{/* Avatar glow ring */}
								<div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-primary/50 via-purple-500/50 to-pink-500/50 opacity-75 blur-sm" />

								{user.image ? (
									<Image
										src={user.image}
										alt={displayName}
										width={96}
										height={96}
										className="relative rounded-2xl border-2 border-background object-cover shadow-xl"
									/>
								) : (
									<div className="relative flex h-24 w-24 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-purple-600 text-4xl font-bold text-primary-foreground shadow-xl">
										{initials}
									</div>
								)}

								{/* Level badge */}
								<div className="absolute -bottom-2 -right-2 flex h-9 w-9 items-center justify-center rounded-full border-3 border-background bg-gradient-to-br from-amber-400 to-orange-500 text-sm font-bold text-white shadow-lg">
									{level}
								</div>
							</div>
						</div>

						{/* Info Section */}
						<div className="flex-1 min-w-0">
							<div className="flex items-start justify-between gap-4">
								<div className="space-y-1">
									<div className="flex items-center gap-2 flex-wrap">
										<h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{displayName}</h1>
										{isPremium && (
											<Badge className="bg-gradient-to-r from-amber-400 to-amber-600 border-0 text-white gap-1 shadow-md">
												<Crown className="h-3 w-3" />
												{t('badges.premium')}
											</Badge>
										)}
										{securityScore === 100 && (
											<Badge
												variant="outline"
												className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 gap-1"
											>
												<ShieldCheck className="h-3 w-3" />
												{t('badges.secure')}
											</Badge>
										)}
									</div>
									{username && <p className="text-muted-foreground">@{username}</p>}

									{/* Level Progress Bar */}
									<div className="mt-3 max-w-xs">
										<div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
											<span className="flex items-center gap-1">
												<Star className="h-3 w-3 text-amber-500" />
												{t('level', { level })}
											</span>
											<span>
												{currentLevelXP}/{nextLevelXP} XP
											</span>
										</div>
										<div className="h-2 w-full overflow-hidden rounded-full bg-muted/50">
											<div
												className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-500"
												style={{ width: `${levelProgress}%` }}
											/>
										</div>
									</div>
								</div>

								{/* Quick actions */}
								<div className="flex gap-2">
									<Link
										href="/settings/profile"
										className="flex h-10 w-10 items-center justify-center rounded-xl border-2 bg-background/80 text-muted-foreground backdrop-blur-sm transition-all hover:border-primary/30 hover:bg-background hover:text-foreground hover:shadow-md"
									>
										<Edit3 className="h-4 w-4" />
									</Link>
									{username && (
										<Link
											href={`/u/${username}`}
											className="flex h-10 w-10 items-center justify-center rounded-xl border-2 bg-background/80 text-muted-foreground backdrop-blur-sm transition-all hover:border-primary/30 hover:bg-background hover:text-foreground hover:shadow-md"
										>
											<ExternalLink className="h-4 w-4" />
										</Link>
									)}
								</div>
							</div>

							{/* Stats Row */}
							<div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
								<StatPill
									icon={
										<Flame
											className={cn(
												'h-4 w-4',
												hasPlayedToday ? 'text-emerald-500' : 'text-orange-500',
											)}
										/>
									}
									value={stats?.currentStreak ?? 0}
									label={t('stats.streak')}
									highlight={stats && stats.currentStreak >= 7}
									status={hasPlayedToday ? 'success' : stats?.currentStreak ? 'warning' : undefined}
								/>
								<StatPill
									icon={<Trophy className="h-4 w-4 text-amber-500" />}
									value={stats?.totalWins ?? 0}
									label={t('stats.wins')}
								/>
								<StatPill
									icon={<Target className="h-4 w-4 text-blue-500" />}
									value={`${winRate}%`}
									label={t('stats.winRate')}
								/>
								<StatPill
									icon={<Gamepad2 className="h-4 w-4 text-purple-500" />}
									value={stats?.gamesPlayed ?? 0}
									label={t('stats.gamesPlayed')}
								/>
							</div>

							{/* Achievement preview */}
							{achievements.length > 0 && (
								<div className="mt-5 flex items-center gap-3">
									<div className="flex -space-x-2">
										{achievements.slice(0, 5).map((achievement) => (
											<div
												key={achievement.id}
												title={achievement.name}
												className={cn(
													'flex h-9 w-9 items-center justify-center rounded-full border-2 border-background shadow-sm',
													TIER_BG_COLORS[achievement.tier],
												)}
											>
												<Icon
													icon={achievement.icon}
													aria-hidden="true"
													className={cn('h-4 w-4', TIER_COLORS[achievement.tier])}
												/>
											</div>
										))}
									</div>
									{achievements.length > 5 && (
										<span className="text-sm text-muted-foreground">
											{t('moreAchievements', { count: achievements.length - 5 })}
										</span>
									)}
								</div>
							)}
						</div>
					</div>
				</div>
			</div>

			{/* Bento Dashboard Grid */}
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
				{/* Security Score Card */}
				<BentoCard
					className="md:row-span-2"
					gradient="from-emerald-500/10 to-teal-500/5"
					accentColor="emerald"
				>
					<div className="flex h-full flex-col">
						<div className="flex items-center justify-between">
							<div>
								<h3 className="font-semibold">{t('securityScore')}</h3>
								<p className="text-sm text-muted-foreground">{t('securityScoreDesc')}</p>
							</div>
						</div>

						<div className="flex flex-1 items-center justify-center py-6">
							<div className="relative">
								<SecurityScoreRing score={securityScore} size="lg" />
								{securityScore === 100 && (
									<div className="absolute -right-1 -top-1">
										<div className="flex h-7 w-7 animate-bounce items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg">
											<ShieldCheck className="h-4 w-4" />
										</div>
									</div>
								)}
							</div>
						</div>

						<div className="space-y-2">
							<div className="flex items-center justify-between text-sm">
								<span className="text-muted-foreground">{t('protectionLevel')}</span>
								<span
									className={cn(
										'font-medium',
										securityScore === 100
											? 'text-emerald-500'
											: securityScore >= 75
												? 'text-blue-500'
												: securityScore >= 50
													? 'text-amber-500'
													: 'text-red-500',
									)}
								>
									{securityScore === 100
										? t('protectionLevels.excellent')
										: securityScore >= 75
											? t('protectionLevels.good')
											: securityScore >= 50
												? t('protectionLevels.fair')
												: t('protectionLevels.needsWork')}
								</span>
							</div>
							<Progress value={securityScore} className="h-2" />
						</div>

						<Link
							href="/settings/security"
							className="mt-4 flex items-center justify-between rounded-xl border-2 bg-background/60 px-4 py-2.5 text-sm font-medium text-muted-foreground transition-all hover:border-emerald-500/30 hover:bg-background hover:text-foreground"
						>
							<span>{securityScore === 100 ? t('viewSecurity') : t('improveSecurity')}</span>
							<ChevronRight className="h-4 w-4" />
						</Link>
					</div>
				</BentoCard>

				{/* Quick Notifications Card */}
				{notificationPreferences && (
					<BentoCard
						className="md:col-span-1 lg:col-span-2"
						gradient="from-blue-500/10 to-indigo-500/5"
						accentColor="blue"
					>
						<h3 className="mb-4 font-semibold">{t('quickNotifications.title')}</h3>
						<QuickNotificationToggles initialPreferences={notificationPreferences} />
					</BentoCard>
				)}

				{/* Streak Status Card */}
				<BentoCard
					gradient={
						hasPlayedToday
							? 'from-emerald-500/10 to-teal-500/5'
							: 'from-orange-500/10 to-amber-500/5'
					}
					accentColor={hasPlayedToday ? 'emerald' : 'orange'}
				>
					<div className="flex items-center justify-between">
						<div>
							<h3 className="font-semibold">{t('streakStatus')}</h3>
							<p className="text-sm text-muted-foreground">
								{hasPlayedToday ? t('playedToday') : t('playToKeepStreak')}
							</p>
						</div>
						<div
							className={cn(
								'flex h-14 w-14 items-center justify-center rounded-2xl',
								hasPlayedToday ? 'bg-emerald-500/20' : 'bg-orange-500/20 animate-pulse',
							)}
						>
							<Flame
								className={cn('h-7 w-7', hasPlayedToday ? 'text-emerald-500' : 'text-orange-500')}
							/>
						</div>
					</div>

					<div className="mt-4 flex items-baseline gap-2">
						<span className="text-5xl font-bold tabular-nums">{stats?.currentStreak ?? 0}</span>
						<span className="text-lg text-muted-foreground">{t('dayStreak')}</span>
					</div>

					{stats && stats.currentStreak > 0 && stats.maxStreak > stats.currentStreak && (
						<div className="mt-4 space-y-2">
							<div className="flex justify-between text-xs text-muted-foreground">
								<span>{t('progressToBest', { best: stats.maxStreak })}</span>
								<span>{Math.round((stats.currentStreak / stats.maxStreak) * 100)}%</span>
							</div>
							<div className="h-2 w-full overflow-hidden rounded-full bg-muted/50">
								<div
									className={cn(
										'h-full rounded-full transition-all duration-500',
										hasPlayedToday
											? 'bg-gradient-to-r from-emerald-400 to-teal-500'
											: 'bg-gradient-to-r from-orange-400 to-amber-500',
									)}
									style={{ width: `${(stats.currentStreak / stats.maxStreak) * 100}%` }}
								/>
							</div>
						</div>
					)}

					{(!stats || stats.currentStreak === 0) && (
						<div className="mt-4">
							<Link
								href="/"
								className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-md transition-all hover:bg-primary/90 hover:shadow-lg"
							>
								<Gamepad2 className="h-4 w-4" />
								{t('startPlaying')}
							</Link>
						</div>
					)}
				</BentoCard>
			</div>

			{/* Settings Navigation Grid */}
			<div>
				<h2 className="mb-4 text-lg font-semibold">{t('allSettings')}</h2>
				<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{quickActions.map((action, index) => (
						<SettingsNavCard key={action.id} {...action} index={index} />
					))}
				</div>
			</div>
		</div>
	)
}

/**
 * Stat Pill Component
 */
function StatPill({
	icon,
	value,
	label,
	highlight,
	status,
}: {
	icon: React.ReactNode
	value: number | string
	label: string
	highlight?: boolean
	status?: 'success' | 'warning'
}) {
	return (
		<div
			className={cn(
				'flex items-center gap-3 rounded-xl border-2 bg-background/60 px-3 py-2.5 backdrop-blur-sm transition-all',
				highlight && 'border-orange-500/30 bg-orange-500/5',
				status === 'success' && 'border-emerald-500/30 bg-emerald-500/5',
				status === 'warning' && !highlight && 'border-amber-500/30 bg-amber-500/5',
			)}
		>
			<div
				className={cn(
					'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
					status === 'success'
						? 'bg-emerald-500/10'
						: status === 'warning'
							? 'bg-amber-500/10'
							: 'bg-muted/50',
				)}
			>
				{icon}
			</div>
			<div className="min-w-0">
				<p className="text-xl font-bold tabular-nums leading-tight">{value}</p>
				<p className="truncate text-xs text-muted-foreground">{label}</p>
			</div>
		</div>
	)
}

/**
 * Bento Card Component
 */
function BentoCard({
	children,
	className,
	gradient,
	accentColor,
}: {
	children: React.ReactNode
	className?: string
	gradient?: string
	accentColor?: 'emerald' | 'blue' | 'orange' | 'purple' | 'pink'
}) {
	const accentColors = {
		emerald: 'from-emerald-500',
		blue: 'from-blue-500',
		orange: 'from-orange-500',
		purple: 'from-purple-500',
		pink: 'from-pink-500',
	}

	return (
		<div
			className={cn(
				'relative overflow-hidden rounded-2xl border-2 bg-card p-5 shadow-sm transition-shadow hover:shadow-md',
				className,
			)}
		>
			{/* Gradient background */}
			{gradient && (
				<div className={cn('absolute inset-0 bg-gradient-to-br opacity-50', gradient)} />
			)}

			{/* Top accent line */}
			{accentColor && (
				<div
					className={cn(
						'absolute left-0 top-0 h-1 w-full bg-gradient-to-r to-transparent',
						accentColors[accentColor],
					)}
				/>
			)}

			<div className="relative">{children}</div>
		</div>
	)
}

/**
 * Settings Navigation Card
 */
function SettingsNavCard({
	icon: Icon,
	label,
	description,
	href,
	iconBg,
	iconColor,
	badge,
	index,
}: {
	icon: typeof Settings
	label: string
	description: string
	href: string
	gradient: string
	iconBg: string
	iconColor: string
	badge?: string
	index: number
}) {
	return (
		<Link
			href={href}
			className="group relative overflow-hidden rounded-xl border-2 bg-card p-4 transition-all duration-200 hover:border-primary/30 hover:shadow-lg"
			style={{ animationDelay: `${index * 50}ms` }}
		>
			<div className="flex items-start gap-3">
				<div
					className={cn(
						'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105',
						iconBg,
					)}
				>
					<Icon className={cn('h-5 w-5', iconColor)} />
				</div>
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2">
						<p className="font-semibold">{label}</p>
						{badge === 'premium' && (
							<Badge className="h-5 bg-gradient-to-r from-amber-400 to-amber-600 border-0 text-white text-[10px] px-1.5">
								<Crown className="h-2.5 w-2.5" />
							</Badge>
						)}
						{badge === 'verified' && (
							<Badge
								variant="outline"
								className="h-5 border-emerald-500/30 bg-emerald-500/10 text-emerald-600 text-[10px] px-1.5"
							>
								<ShieldCheck className="h-2.5 w-2.5" />
							</Badge>
						)}
						{badge === 'warning' && (
							<Badge
								variant="outline"
								className="h-5 border-orange-500/30 bg-orange-500/10 text-orange-600 text-[10px] px-1.5"
							>
								!
							</Badge>
						)}
						{badge && !['premium', 'verified', 'warning'].includes(badge) && (
							<Badge variant="secondary" className="h-5 text-[10px] px-1.5">
								{badge}
							</Badge>
						)}
					</div>
					<p className="text-sm text-muted-foreground line-clamp-1">{description}</p>
				</div>
				<ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
			</div>
		</Link>
	)
}

/**
 * Loading skeleton for overview
 */
function OverviewSkeleton() {
	return (
		<div className="space-y-6">
			{/* Hero skeleton */}
			<Skeleton className="h-[240px] rounded-2xl" />

			{/* Bento grid skeleton */}
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
				<Skeleton className="h-[300px] rounded-2xl md:row-span-2" />
				<Skeleton className="h-[180px] rounded-2xl lg:col-span-2" />
				<Skeleton className="h-[200px] rounded-2xl" />
			</div>

			{/* Nav grid skeleton */}
			<div>
				<Skeleton className="mb-4 h-7 w-32" />
				<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{Array.from({ length: 6 }).map((_, i) => (
						<Skeleton key={i} className="h-[88px] rounded-xl" />
					))}
				</div>
			</div>
		</div>
	)
}
