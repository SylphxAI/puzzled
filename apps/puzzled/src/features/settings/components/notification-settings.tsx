'use client'

import {
	Bell,
	BellOff,
	BellRing,
	Calendar,
	Check,
	Clock,
	Flame,
	Gamepad2,
	Loader2,
	Mail,
	MailCheck,
	Newspaper,
	Send,
	Smartphone,
	Sparkles,
	Zap,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useState, useTransition } from 'react'
import { usePushNotifications } from '@/features/notifications'
import { cn } from '@/lib/utils'
import { Badge, Button, Switch } from '@/shared/components/ui'
import { useToast } from '@/shared/components/ui/toast'
import { trpc } from '@/trpc'
import { type NotificationPreferences, updateNotificationPreferences } from '../server'

type NotificationSettingsProps = {
	initialPreferences: NotificationPreferences
}

/**
 * Modern notification card component
 */
function NotificationCard({
	icon,
	iconBg,
	title,
	description,
	enabled,
	onToggle,
	disabled = false,
	badge,
	children,
}: {
	icon: React.ReactNode
	iconBg: string
	title: string
	description: string
	enabled: boolean
	onToggle: (enabled: boolean) => void
	disabled?: boolean
	badge?: string
	children?: React.ReactNode
}) {
	return (
		<div
			className={cn(
				'group rounded-xl border p-4 transition-all duration-200',
				enabled ? 'bg-primary/5 border-primary/20' : 'bg-background hover:bg-muted/30',
				disabled && 'opacity-50 cursor-not-allowed',
			)}
		>
			<div className="flex items-start gap-4">
				<div
					className={cn(
						'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105',
						iconBg,
					)}
				>
					{icon}
				</div>
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2">
						<h4 className="font-medium">{title}</h4>
						{badge && (
							<Badge variant="secondary" className="h-5 text-[10px]">
								{badge}
							</Badge>
						)}
					</div>
					<p className="text-sm text-muted-foreground mt-0.5">{description}</p>
					{children && enabled && <div className="mt-3">{children}</div>}
				</div>
				<Switch
					checked={enabled}
					onCheckedChange={onToggle}
					disabled={disabled}
					className="shrink-0"
					aria-label={title}
				/>
			</div>
		</div>
	)
}

/**
 * Quick toggle button for notification types
 */
function QuickToggle({
	icon,
	label,
	enabled,
	onClick,
}: {
	icon: React.ReactNode
	label: string
	enabled: boolean
	onClick: () => void
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				'flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-all hover:scale-105',
				enabled
					? 'bg-primary/10 border-primary/30 text-primary'
					: 'bg-background hover:bg-muted/50 text-muted-foreground',
			)}
		>
			<div
				className={cn(
					'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
					enabled ? 'bg-primary/20' : 'bg-muted',
				)}
			>
				{icon}
			</div>
			<span className="text-xs font-medium">{label}</span>
			{enabled && <Check className="h-3 w-3 text-primary" />}
		</button>
	)
}

export function NotificationSettings({ initialPreferences }: NotificationSettingsProps) {
	const t = useTranslations('settings')
	const tn = useTranslations('settings.notifications')
	const toast = useToast()
	const { isSupported, isEnabled, isSubscribed } = usePushNotifications()
	const [isPending, startTransition] = useTransition()

	// Local state
	const [prefs, setPrefs] = useState(initialPreferences)

	// Test notification mutations
	const testPushMutation = trpc.settings.testPushNotification.useMutation({
		onSuccess: (data) => {
			toast.success(t('testPushSent'), t('testPushSentDescription', { count: data.sent }))
		},
		onError: (error) => {
			toast.error(t('testPushFailed'), error.message)
		},
	})

	const testEmailMutation = trpc.settings.testEmailNotification.useMutation({
		onSuccess: () => {
			toast.success(t('testEmailSent'), t('testEmailSentDescription'))
		},
		onError: (error) => {
			toast.error(t('testEmailFailed'), error.message)
		},
	})

	// Update local state when initial preferences change
	useEffect(() => {
		setPrefs(initialPreferences)
	}, [initialPreferences])

	const handleUpdate = (updates: Partial<NotificationPreferences>) => {
		// Optimistic update
		setPrefs((prev) => ({ ...prev, ...updates }))

		// Save to server
		startTransition(async () => {
			const result = await updateNotificationPreferences(updates)
			if (!result.success) {
				// Revert on failure
				setPrefs(initialPreferences)
			}
		})
	}

	const canEnablePush = isSupported && isEnabled && isSubscribed

	// Count enabled notifications
	const pushEnabledCount = [
		prefs.pushDailyReminder,
		prefs.pushStreakAlert,
		prefs.pushNewGames,
	].filter(Boolean).length
	const emailEnabledCount = [prefs.emailWeeklyDigest, prefs.emailMarketing].filter(Boolean).length

	return (
		<div className="space-y-8">
			{/* Overview Header */}
			<div className="rounded-xl border bg-gradient-to-br from-background to-muted/30 p-5">
				<div className="flex items-start justify-between">
					<div className="space-y-1">
						<div className="flex items-center gap-2">
							<BellRing className="h-5 w-5 text-primary" />
							<h3 className="font-semibold">{tn('overview.title')}</h3>
						</div>
						<p className="text-sm text-muted-foreground">{tn('overview.description')}</p>
					</div>
					<Badge
						variant={prefs.pushEnabled || prefs.emailEnabled ? 'default' : 'secondary'}
						className="gap-1.5"
					>
						{prefs.pushEnabled || prefs.emailEnabled ? (
							<>
								<Bell className="h-3 w-3" />
								{tn('overview.enabled')}
							</>
						) : (
							<>
								<BellOff className="h-3 w-3" />
								{tn('overview.disabled')}
							</>
						)}
					</Badge>
				</div>

				{/* Quick Status */}
				<div className="mt-4 grid grid-cols-2 gap-3">
					<div
						className={cn(
							'flex items-center gap-3 rounded-lg border p-3',
							prefs.pushEnabled ? 'bg-primary/5 border-primary/20' : 'bg-muted/30',
						)}
					>
						<Smartphone
							className={cn(
								'h-5 w-5',
								prefs.pushEnabled ? 'text-primary' : 'text-muted-foreground',
							)}
						/>
						<div>
							<p className="text-sm font-medium">{tn('overview.push')}</p>
							<p className="text-xs text-muted-foreground">
								{prefs.pushEnabled
									? tn('overview.pushActive', { count: pushEnabledCount })
									: tn('overview.pushOff')}
							</p>
						</div>
					</div>
					<div
						className={cn(
							'flex items-center gap-3 rounded-lg border p-3',
							prefs.emailEnabled ? 'bg-primary/5 border-primary/20' : 'bg-muted/30',
						)}
					>
						<Mail
							className={cn(
								'h-5 w-5',
								prefs.emailEnabled ? 'text-primary' : 'text-muted-foreground',
							)}
						/>
						<div>
							<p className="text-sm font-medium">{tn('overview.email')}</p>
							<p className="text-xs text-muted-foreground">
								{prefs.emailEnabled
									? tn('overview.emailActive', { count: emailEnabledCount })
									: tn('overview.emailOff')}
							</p>
						</div>
					</div>
				</div>
			</div>

			{/* Push Notifications Section */}
			<section className="space-y-4">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<Smartphone className="h-5 w-5 text-muted-foreground" />
						<h3 className="font-semibold">{t('pushNotifications')}</h3>
					</div>
					<Switch
						checked={prefs.pushEnabled && canEnablePush}
						onCheckedChange={(checked) => handleUpdate({ pushEnabled: checked })}
						disabled={!canEnablePush || isPending}
						aria-label={t('pushNotifications')}
					/>
				</div>

				{!canEnablePush && (
					<div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3">
						<p className="text-sm text-yellow-700 dark:text-yellow-400">
							{!isSupported
								? t('pushUnsupported')
								: !isEnabled
									? t('pushDisabled')
									: !isSubscribed
										? t('pushNotSubscribed')
										: t('pushMasterDisabled')}
						</p>
					</div>
				)}

				<div className={cn('space-y-3', !prefs.pushEnabled && 'opacity-50 pointer-events-none')}>
					<NotificationCard
						icon={<Calendar className="h-5 w-5 text-blue-500" />}
						iconBg="bg-blue-500/10"
						title={t('pushDailyReminder')}
						description={t('pushDailyReminderDescription')}
						enabled={prefs.pushDailyReminder}
						onToggle={(checked) => handleUpdate({ pushDailyReminder: checked })}
						disabled={!prefs.pushEnabled || !canEnablePush || isPending}
					>
						<div className="flex items-center gap-2 text-sm">
							<Clock className="h-4 w-4 text-muted-foreground" />
							<span className="text-muted-foreground">{t('dailyReminderTime')}:</span>
							<input
								type="time"
								value={prefs.dailyReminderTime || '09:00'}
								onChange={(e) => handleUpdate({ dailyReminderTime: e.target.value })}
								disabled={!prefs.pushEnabled || !canEnablePush || isPending}
								className="rounded-md border border-input bg-background px-2 py-1 text-sm font-medium"
								aria-label={t('dailyReminderTime')}
							/>
						</div>
					</NotificationCard>

					<NotificationCard
						icon={<Flame className="h-5 w-5 text-orange-500" />}
						iconBg="bg-orange-500/10"
						title={t('pushStreakAlert')}
						description={t('pushStreakAlertDescription')}
						enabled={prefs.pushStreakAlert}
						onToggle={(checked) => handleUpdate({ pushStreakAlert: checked })}
						disabled={!prefs.pushEnabled || !canEnablePush || isPending}
						badge={tn('recommended')}
					/>

					<NotificationCard
						icon={<Gamepad2 className="h-5 w-5 text-purple-500" />}
						iconBg="bg-purple-500/10"
						title={t('pushNewGames')}
						description={t('pushNewGamesDescription')}
						enabled={prefs.pushNewGames}
						onToggle={(checked) => handleUpdate({ pushNewGames: checked })}
						disabled={!prefs.pushEnabled || !canEnablePush || isPending}
					/>

					{/* Test Push */}
					<div className="flex items-center justify-between rounded-lg border border-dashed p-3">
						<div className="flex items-center gap-2">
							<Send className="h-4 w-4 text-muted-foreground" />
							<span className="text-sm text-muted-foreground">{t('testPushDescription')}</span>
						</div>
						<Button
							variant="outline"
							size="sm"
							onClick={() => testPushMutation.mutate()}
							disabled={!prefs.pushEnabled || !canEnablePush || testPushMutation.isPending}
						>
							{testPushMutation.isPending ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								t('testPush')
							)}
						</Button>
					</div>
				</div>
			</section>

			{/* Email Notifications Section */}
			<section className="space-y-4">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<Mail className="h-5 w-5 text-muted-foreground" />
						<h3 className="font-semibold">{t('emailNotifications')}</h3>
					</div>
					<Switch
						checked={prefs.emailEnabled}
						onCheckedChange={(checked) => handleUpdate({ emailEnabled: checked })}
						disabled={isPending}
						aria-label={t('emailNotifications')}
					/>
				</div>

				<div className={cn('space-y-3', !prefs.emailEnabled && 'opacity-50 pointer-events-none')}>
					<NotificationCard
						icon={<Newspaper className="h-5 w-5 text-green-500" />}
						iconBg="bg-green-500/10"
						title={t('emailWeeklyDigest')}
						description={t('emailWeeklyDigestDescription')}
						enabled={prefs.emailWeeklyDigest}
						onToggle={(checked) => handleUpdate({ emailWeeklyDigest: checked })}
						disabled={!prefs.emailEnabled || isPending}
						badge={tn('recommended')}
					>
						<div className="flex items-center gap-2 text-sm text-muted-foreground">
							<MailCheck className="h-4 w-4" />
							<span>{tn('sentEverySunday')}</span>
						</div>
					</NotificationCard>

					<NotificationCard
						icon={<Sparkles className="h-5 w-5 text-pink-500" />}
						iconBg="bg-pink-500/10"
						title={t('emailMarketing')}
						description={t('emailMarketingDescription')}
						enabled={prefs.emailMarketing}
						onToggle={(checked) => handleUpdate({ emailMarketing: checked })}
						disabled={!prefs.emailEnabled || isPending}
					/>

					{/* Test Email */}
					<div className="flex items-center justify-between rounded-lg border border-dashed p-3">
						<div className="flex items-center gap-2">
							<Send className="h-4 w-4 text-muted-foreground" />
							<span className="text-sm text-muted-foreground">{t('testEmailDescription')}</span>
						</div>
						<Button
							variant="outline"
							size="sm"
							onClick={() => testEmailMutation.mutate()}
							disabled={!prefs.emailEnabled || testEmailMutation.isPending}
						>
							{testEmailMutation.isPending ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								t('testEmail')
							)}
						</Button>
					</div>
				</div>
			</section>

			{/* Quick Actions */}
			<section className="space-y-4">
				<h3 className="flex items-center gap-2 font-semibold text-muted-foreground">
					<Zap className="h-4 w-4" />
					{tn('quickActions.title')}
				</h3>
				<div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
					<QuickToggle
						icon={<Bell className="h-4 w-4" />}
						label={tn('quickActions.all')}
						enabled={
							prefs.pushEnabled &&
							prefs.emailEnabled &&
							prefs.pushDailyReminder &&
							prefs.pushStreakAlert
						}
						onClick={() => {
							const enableAll =
								!prefs.pushEnabled || !prefs.emailEnabled || !prefs.pushDailyReminder
							handleUpdate({
								pushEnabled: enableAll,
								emailEnabled: enableAll,
								pushDailyReminder: enableAll,
								pushStreakAlert: enableAll,
								pushNewGames: enableAll,
								emailWeeklyDigest: enableAll,
							})
						}}
					/>
					<QuickToggle
						icon={<Calendar className="h-4 w-4" />}
						label={tn('quickActions.daily')}
						enabled={prefs.pushDailyReminder}
						onClick={() => handleUpdate({ pushDailyReminder: !prefs.pushDailyReminder })}
					/>
					<QuickToggle
						icon={<Flame className="h-4 w-4" />}
						label={tn('quickActions.streak')}
						enabled={prefs.pushStreakAlert}
						onClick={() => handleUpdate({ pushStreakAlert: !prefs.pushStreakAlert })}
					/>
					<QuickToggle
						icon={<Newspaper className="h-4 w-4" />}
						label={tn('quickActions.digest')}
						enabled={prefs.emailWeeklyDigest}
						onClick={() => handleUpdate({ emailWeeklyDigest: !prefs.emailWeeklyDigest })}
					/>
					<QuickToggle
						icon={<BellOff className="h-4 w-4" />}
						label={tn('quickActions.mute')}
						enabled={!prefs.pushEnabled && !prefs.emailEnabled}
						onClick={() => {
							handleUpdate({
								pushEnabled: false,
								emailEnabled: false,
							})
						}}
					/>
				</div>
			</section>
		</div>
	)
}
