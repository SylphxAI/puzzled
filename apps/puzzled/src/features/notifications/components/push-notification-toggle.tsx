'use client'

import { Bell, BellOff, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/shared/components/ui'
import { usePushNotifications } from '../hooks/use-push-notifications'

export function PushNotificationToggle() {
	const t = useTranslations('settings')
	const { state, isLoading, isSupported, isEnabled, isSubscribed, subscribe, unsubscribe } =
		usePushNotifications()

	if (!isSupported) {
		return (
			<div className="flex items-center justify-between">
				<div>
					<p className="font-medium">{t('pushNotifications')}</p>
					<p className="text-sm text-muted-foreground">{t('pushUnsupported')}</p>
				</div>
				<BellOff className="h-5 w-5 text-muted-foreground" />
			</div>
		)
	}

	if (!isEnabled) {
		return (
			<div className="flex items-center justify-between">
				<div>
					<p className="font-medium">{t('pushNotifications')}</p>
					<p className="text-sm text-muted-foreground">{t('pushDisabled')}</p>
				</div>
				<BellOff className="h-5 w-5 text-muted-foreground" />
			</div>
		)
	}

	if (state === 'denied') {
		return (
			<div className="flex items-center justify-between">
				<div>
					<p className="font-medium">{t('pushNotifications')}</p>
					<p className="text-sm text-muted-foreground">{t('pushDenied')}</p>
				</div>
				<BellOff className="h-5 w-5 text-wrong" />
			</div>
		)
	}

	if (state === 'loading') {
		return (
			<div className="flex items-center justify-between">
				<div>
					<p className="font-medium">{t('pushNotifications')}</p>
					<p className="text-sm text-muted-foreground">{t('pushLoading')}</p>
				</div>
				<Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
			</div>
		)
	}

	return (
		<div className="flex items-center justify-between">
			<div>
				<p className="font-medium">{t('pushNotifications')}</p>
				<p className="text-sm text-muted-foreground">
					{isSubscribed ? t('pushEnabled') : t('pushDescription')}
				</p>
			</div>
			<Button
				variant={isSubscribed ? 'outline' : 'default'}
				size="sm"
				onClick={isSubscribed ? unsubscribe : subscribe}
				disabled={isLoading}
			>
				{isLoading ? (
					<Loader2 className="mr-2 h-4 w-4 animate-spin" />
				) : isSubscribed ? (
					<BellOff className="mr-2 h-4 w-4" />
				) : (
					<Bell className="mr-2 h-4 w-4" />
				)}
				{isSubscribed ? t('pushDisable') : t('pushEnable')}
			</Button>
		</div>
	)
}
