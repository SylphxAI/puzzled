'use client'

import { formatDistanceToNow } from 'date-fns'
import { Apple, Check, Facebook, Github, Loader2, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/shared/components/ui'

// Discord icon (not in lucide)
function DiscordIcon({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
			<title>Discord</title>
			<path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
		</svg>
	)
}

// Microsoft icon (not in lucide)
function MicrosoftIcon({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
			<title>Microsoft</title>
			<path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zm12.6 0H12.6V0H24v11.4z" />
		</svg>
	)
}

// Twitter/X icon
function TwitterIcon({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
			<title>X (Twitter)</title>
			<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
		</svg>
	)
}

// Twitch icon
function TwitchIcon({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
			<title>Twitch</title>
			<path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z" />
		</svg>
	)
}

// Steam icon
function SteamIcon({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
			<title>Steam</title>
			<path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.454 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.253 0-2.265-1.014-2.265-2.265z" />
		</svg>
	)
}

// Google icon (better than Chrome)
function GoogleIcon({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 24 24" className={className} aria-hidden="true">
			<title>Google</title>
			<path
				fill="#4285F4"
				d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
			/>
			<path
				fill="#34A853"
				d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
			/>
			<path
				fill="#FBBC05"
				d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
			/>
			<path
				fill="#EA4335"
				d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
			/>
		</svg>
	)
}

export const PROVIDER_CONFIG = {
	google: {
		name: 'Google',
		icon: GoogleIcon,
		className: '',
		bgConnected: 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-900/50',
		category: 'primary',
	},
	apple: {
		name: 'Apple',
		icon: Apple,
		className: '',
		bgConnected: 'bg-gray-50 border-gray-200 dark:bg-gray-900/30 dark:border-gray-800',
		category: 'primary',
	},
	facebook: {
		name: 'Facebook',
		icon: Facebook,
		className: 'text-[#1877F2]',
		bgConnected: 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-900/50',
		category: 'social',
	},
	github: {
		name: 'GitHub',
		icon: Github,
		className: '',
		bgConnected: 'bg-gray-50 border-gray-200 dark:bg-gray-900/30 dark:border-gray-800',
		category: 'developer',
	},
	discord: {
		name: 'Discord',
		icon: DiscordIcon,
		className: 'text-[#5865F2]',
		bgConnected: 'bg-indigo-50 border-indigo-200 dark:bg-indigo-950/30 dark:border-indigo-900/50',
		category: 'gaming',
	},
	microsoft: {
		name: 'Microsoft',
		icon: MicrosoftIcon,
		className: '',
		bgConnected: 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-900/50',
		category: 'primary',
	},
	twitter: {
		name: 'X (Twitter)',
		icon: TwitterIcon,
		className: '',
		bgConnected: 'bg-gray-50 border-gray-200 dark:bg-gray-900/30 dark:border-gray-800',
		category: 'social',
	},
	twitch: {
		name: 'Twitch',
		icon: TwitchIcon,
		className: 'text-[#9146FF]',
		bgConnected: 'bg-purple-50 border-purple-200 dark:bg-purple-950/30 dark:border-purple-900/50',
		category: 'gaming',
	},
	steam: {
		name: 'Steam',
		icon: SteamIcon,
		className: 'text-[#1b2838]',
		bgConnected: 'bg-slate-50 border-slate-200 dark:bg-slate-950/30 dark:border-slate-900/50',
		category: 'gaming',
	},
} as const

type ProviderKey = keyof typeof PROVIDER_CONFIG

// Export the provider keys for use in connected-accounts
export const ALL_PROVIDER_KEYS = Object.keys(PROVIDER_CONFIG) as ProviderKey[]

type ProviderCardProps = {
	provider: ProviderKey
	connected: boolean
	accountId?: string
	connectedAt?: Date
	/** Per-provider permission from SSOT (auth-state.ts) */
	canDisconnect: boolean
	/** Reason why disconnect is blocked (from SSOT) */
	disconnectBlockedReason?: string | null
	onConnect: (provider: ProviderKey) => Promise<void>
	onDisconnect: (accountId: string) => Promise<void>
}

export function ProviderCard({
	provider,
	connected,
	accountId,
	connectedAt,
	canDisconnect,
	disconnectBlockedReason,
	onConnect,
	onDisconnect,
}: ProviderCardProps) {
	const t = useTranslations('settings.connectedAccounts')
	const [loading, setLoading] = useState(false)
	const config = PROVIDER_CONFIG[provider]
	const Icon = config.icon

	const handleConnect = async () => {
		setLoading(true)
		try {
			await onConnect(provider)
		} finally {
			setLoading(false)
		}
	}

	const handleDisconnect = async () => {
		if (!accountId || !canDisconnect) return
		setLoading(true)
		try {
			await onDisconnect(accountId)
		} finally {
			setLoading(false)
		}
	}

	return (
		<div
			className={cn(
				'group relative flex items-center justify-between rounded-xl border p-4 transition-all duration-200',
				connected
					? config.bgConnected
					: 'bg-background hover:bg-muted/30 hover:border-primary/20 hover:shadow-sm',
			)}
		>
			<div className="flex items-center gap-3">
				<div
					className={cn(
						'relative flex h-11 w-11 items-center justify-center rounded-xl transition-transform group-hover:scale-105',
						connected ? 'bg-white shadow-sm dark:bg-gray-800' : 'bg-muted',
					)}
				>
					<Icon className={cn('h-5 w-5', config.className)} />
					{connected && (
						<div className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-success text-white">
							<Check className="h-2.5 w-2.5" strokeWidth={3} />
						</div>
					)}
				</div>
				<div className="space-y-0.5">
					<p className="font-medium">{config.name}</p>
					<p className="text-sm text-muted-foreground">
						{connected
							? connectedAt
								? t('connectedTime', {
										time: formatDistanceToNow(new Date(connectedAt), { addSuffix: true }),
									})
								: t('connected')
							: t('notConnected')}
					</p>
				</div>
			</div>
			{connected ? (
				<Button
					variant="outline"
					size="sm"
					onClick={handleDisconnect}
					disabled={loading || !canDisconnect}
					// Show SSOT reason or fallback to generic translation
					title={!canDisconnect ? (disconnectBlockedReason ?? t('cannotDisconnect')) : undefined}
					aria-label={t('disconnectProvider', { provider: config.name })}
					className="gap-1.5 rounded-lg"
				>
					{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
					<span className="hidden sm:inline">{t('disconnect')}</span>
				</Button>
			) : (
				<Button
					variant="default"
					size="sm"
					onClick={handleConnect}
					disabled={loading}
					className="gap-1.5 rounded-lg"
				>
					{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('connect')}
				</Button>
			)}
		</div>
	)
}
