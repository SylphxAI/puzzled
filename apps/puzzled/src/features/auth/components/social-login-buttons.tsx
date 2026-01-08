'use client'

import { Apple, Facebook, Github, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { signIn } from '@/features/auth'
import { Button } from '@/shared/components/ui'

// Custom icons for providers not in lucide
function DiscordIcon({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
			<title>Discord</title>
			<path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
		</svg>
	)
}

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

function MicrosoftIcon({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
			<title>Microsoft</title>
			<path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zm12.6 0H12.6V0H24v11.4z" />
		</svg>
	)
}

/**
 * UI config for login button providers
 * Only providers we want to show on login/signup pages
 */
const LOGIN_PROVIDER_UI = {
	google: { name: 'Google', icon: GoogleIcon, className: '' },
	apple: { name: 'Apple', icon: Apple, className: '' },
	microsoft: { name: 'Microsoft', icon: MicrosoftIcon, className: '' },
	facebook: { name: 'Facebook', icon: Facebook, className: 'text-[#1877F2]' },
	github: { name: 'GitHub', icon: Github, className: '' },
	discord: { name: 'Discord', icon: DiscordIcon, className: 'text-[#5865F2]' },
} as const

type LoginProviderKey = keyof typeof LOGIN_PROVIDER_UI

// Order of providers on login page
const LOGIN_PROVIDER_ORDER: LoginProviderKey[] = [
	'google',
	'apple',
	'microsoft',
	'discord',
	'github',
	'facebook',
]

export function SocialLoginButtons({ disabled }: { disabled?: boolean }) {
	const t = useTranslations('auth')
	const [enabledProviders, setEnabledProviders] = useState<Record<string, boolean> | null>(null)
	const [loading, setLoading] = useState<LoginProviderKey | null>(null)
	const [error, setError] = useState('')

	useEffect(() => {
		fetch('/api/auth/providers')
			.then((res) => res.json())
			.then(setEnabledProviders)
			.catch(() => {
				// Fetch failed - fallback to empty providers (shows all disabled)
				setEnabledProviders({})
			})
	}, [])

	const handleSocialLogin = async (provider: LoginProviderKey) => {
		setLoading(provider)
		setError('')
		try {
			await signIn.social({
				provider,
				callbackURL: '/',
			})
		} catch {
			setError(t('socialLoginFailed', { provider: LOGIN_PROVIDER_UI[provider].name }))
			setLoading(null)
		}
	}

	// Don't render anything while loading providers
	if (!enabledProviders) {
		return (
			<div className="flex justify-center py-4">
				<Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
			</div>
		)
	}

	// Get providers that are: 1) enabled from backend, 2) have UI config
	// Maintain display order from LOGIN_PROVIDER_ORDER
	const visibleProviders = LOGIN_PROVIDER_ORDER.filter(
		(provider) => enabledProviders[provider] && provider in LOGIN_PROVIDER_UI,
	)

	// Don't render if no providers are enabled
	if (visibleProviders.length === 0) {
		return null
	}

	return (
		<>
			{error && (
				<div className="rounded-lg bg-wrong/10 p-3 text-center text-sm text-wrong">{error}</div>
			)}
			<div className="space-y-2">
				{visibleProviders.map((provider) => {
					const config = LOGIN_PROVIDER_UI[provider]
					const Icon = config.icon
					const isLoading = loading === provider

					return (
						<Button
							key={provider}
							variant="outline"
							className="w-full"
							onClick={() => handleSocialLogin(provider)}
							disabled={disabled || loading !== null}
						>
							{isLoading ? (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							) : (
								<Icon className={`mr-2 h-4 w-4 ${config.className}`} />
							)}
							{config.name}
						</Button>
					)
				})}
			</div>
		</>
	)
}
