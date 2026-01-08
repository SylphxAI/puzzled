'use client'

import { Bell, BellOff, BellRing, Calendar, Flame, Loader2, Mail, Smartphone } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useState, useTransition } from 'react'
import { usePushNotifications } from '@/features/notifications'
import { Link } from '@/lib/i18n/routing'
import { cn } from '@/lib/utils'
import { Switch } from '@sylphx/ui'
import { type NotificationPreferences, updateNotificationPreferences } from '../server'

type QuickNotificationTogglesProps = {
	initialPreferences: NotificationPreferences
}

/**
 * Compact notification toggles for the Overview page
 * Shows only the most important notification settings
 */
export function QuickNotificationToggles({ initialPreferences }: QuickNotificationTogglesProps) {
	const tq = useTranslations('settings.overview.quickNotifications')
	const { isSupported, isEnabled, isSubscribed } = usePushNotifications()
	const [isPending, startTransition] = useTransition()
	const [prefs, setPrefs] = useState(initialPreferences)

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
	const allEnabled = prefs.pushEnabled && prefs.emailEnabled

	return (
		<div className="space-y-4">
			{/* Quick Status */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					{allEnabled ? (
						<BellRing className="h-5 w-5 text-primary" />
					) : (
						<BellOff className="h-5 w-5 text-muted-foreground" />
					)}
					<span className="font-medium">{allEnabled ? tq('enabled') : tq('disabled')}</span>
				</div>
				{isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
			</div>

			{/* Toggle Grid */}
			<div className="grid grid-cols-2 gap-3">
				{/* Daily Reminder */}
				<button
					type="button"
					onClick={() => {
						if (!prefs.pushEnabled && canEnablePush) {
							handleUpdate({ pushEnabled: true, pushDailyReminder: true })
						} else {
							handleUpdate({ pushDailyReminder: !prefs.pushDailyReminder })
						}
					}}
					disabled={!canEnablePush || isPending}
					className={cn(
						'flex items-center gap-3 rounded-xl border p-3 transition-all',
						prefs.pushDailyReminder && prefs.pushEnabled
							? 'bg-primary/5 border-primary/30'
							: 'bg-background hover:bg-muted/50',
						(!canEnablePush || isPending) && 'opacity-50 cursor-not-allowed',
					)}
				>
					<div
						className={cn(
							'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
							prefs.pushDailyReminder && prefs.pushEnabled ? 'bg-blue-500/20' : 'bg-muted',
						)}
					>
						<Calendar
							className={cn(
								'h-4 w-4',
								prefs.pushDailyReminder && prefs.pushEnabled
									? 'text-blue-500'
									: 'text-muted-foreground',
							)}
						/>
					</div>
					<div className="flex-1 text-left">
						<p className="text-sm font-medium">{tq('daily')}</p>
						<p className="text-xs text-muted-foreground">{tq('dailyDesc')}</p>
					</div>
				</button>

				{/* Streak Alert */}
				<button
					type="button"
					onClick={() => {
						if (!prefs.pushEnabled && canEnablePush) {
							handleUpdate({ pushEnabled: true, pushStreakAlert: true })
						} else {
							handleUpdate({ pushStreakAlert: !prefs.pushStreakAlert })
						}
					}}
					disabled={!canEnablePush || isPending}
					className={cn(
						'flex items-center gap-3 rounded-xl border p-3 transition-all',
						prefs.pushStreakAlert && prefs.pushEnabled
							? 'bg-primary/5 border-primary/30'
							: 'bg-background hover:bg-muted/50',
						(!canEnablePush || isPending) && 'opacity-50 cursor-not-allowed',
					)}
				>
					<div
						className={cn(
							'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
							prefs.pushStreakAlert && prefs.pushEnabled ? 'bg-orange-500/20' : 'bg-muted',
						)}
					>
						<Flame
							className={cn(
								'h-4 w-4',
								prefs.pushStreakAlert && prefs.pushEnabled
									? 'text-orange-500'
									: 'text-muted-foreground',
							)}
						/>
					</div>
					<div className="flex-1 text-left">
						<p className="text-sm font-medium">{tq('streak')}</p>
						<p className="text-xs text-muted-foreground">{tq('streakDesc')}</p>
					</div>
				</button>
			</div>

			{/* Master Toggles */}
			<div className="flex items-center gap-4 rounded-lg border p-3">
				<div className="flex flex-1 items-center gap-2">
					<Smartphone
						className={cn('h-4 w-4', prefs.pushEnabled ? 'text-primary' : 'text-muted-foreground')}
					/>
					<span className="text-sm">{tq('push')}</span>
					<Switch
						checked={prefs.pushEnabled && canEnablePush}
						onCheckedChange={(checked) => handleUpdate({ pushEnabled: checked })}
						disabled={!canEnablePush || isPending}
						className="ml-auto"
						aria-label={tq('push')}
					/>
				</div>
				<div className="h-6 w-px bg-border" />
				<div className="flex flex-1 items-center gap-2">
					<Mail
						className={cn('h-4 w-4', prefs.emailEnabled ? 'text-primary' : 'text-muted-foreground')}
					/>
					<span className="text-sm">{tq('email')}</span>
					<Switch
						checked={prefs.emailEnabled}
						onCheckedChange={(checked) => handleUpdate({ emailEnabled: checked })}
						disabled={isPending}
						className="ml-auto"
						aria-label={tq('email')}
					/>
				</div>
			</div>

			{/* Link to full settings */}
			<Link
				href="/settings/notifications"
				className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
			>
				<Bell className="h-4 w-4" />
				{tq('manageAll')}
			</Link>
		</div>
	)
}
