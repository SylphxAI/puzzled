'use client'

import { OAuthIcons, type OAuthProvider, useSafeAuth, useSignInForm } from '@sylphx/sdk/react'
import { Button, GamepadIcon, Input } from '@sylphx/ui'
import { Eye, EyeOff, Loader2, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { Link } from '@/lib/i18n/routing'

interface LoginFormProps {
	providers: OAuthProvider[]
}

export function LoginForm({ providers }: LoginFormProps) {
	const t = useTranslations('auth')
	const tCommon = useTranslations('common')
	const [showPassword, setShowPassword] = useState(false)
	const { signInWithOAuth, oauthError } = useSafeAuth()

	const {
		form,
		setEmail,
		setPassword,
		isLoading,
		loadingProvider,
		error,
		handlePasswordSubmit,
		handleOAuthSignIn,
	} = useSignInForm({
		methods: ['password'],
		providers,
		afterSignInUrl: '/',
		// OAuth handler: direct OAuth flow (Firebase/Supabase pattern)
		// Goes directly to provider (Google, GitHub, etc.) - no platform UI
		oauthHandler: async (provider) => {
			await signInWithOAuth?.({ provider: provider as any, redirectUrl: '/' })
		},
	})

	return (
		<div className="relative flex min-h-screen flex-col items-center justify-center px-4">
			{/* Close button */}
			<Link
				href="/"
				className="absolute right-4 top-4 rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
				aria-label={t('close')}
			>
				<X className="h-6 w-6" />
			</Link>

			<div className="w-full max-w-[400px] space-y-8">
				{/* Logo & Title */}
				<div className="text-center">
					<div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-violet-500/20">
						<GamepadIcon size={40} className="text-primary" />
					</div>
					<h1 className="text-2xl font-bold tracking-tight">{t('welcomeBack')}</h1>
					<p className="mt-2 text-muted-foreground">{t('signInToContinue')}</p>
				</div>

				{/* OAuth Buttons - only show if providers are enabled */}
				{providers.length > 0 && (
					<>
						<div className="space-y-3">
							{providers.map((provider) => {
								const Icon = OAuthIcons[provider as keyof typeof OAuthIcons]
								const isProviderLoading = loadingProvider === provider
								return (
									<Button
										key={provider}
										variant="outline"
										className="relative h-12 w-full gap-3 text-base font-medium"
										onClick={() => handleOAuthSignIn(provider)}
										disabled={isLoading}
									>
										{isProviderLoading ? (
											<Loader2 className="h-5 w-5 animate-spin" />
										) : (
											<Icon className="h-5 w-5" />
										)}
										{t('continueWith', {
											provider: provider.charAt(0).toUpperCase() + provider.slice(1),
										})}
									</Button>
								)
							})}
						</div>

						{/* Divider */}
						<div className="relative">
							<div className="absolute inset-0 flex items-center">
								<div className="w-full border-t" />
							</div>
							<div className="relative flex justify-center text-xs uppercase">
								<span className="bg-background px-2 text-muted-foreground">
									{t('orContinueWith')}
								</span>
							</div>
						</div>
					</>
				)}

				{/* Email/Password Form */}
				<form onSubmit={handlePasswordSubmit} className="space-y-4">
					{/* Email */}
					<div className="space-y-2">
						<label htmlFor="email" className="text-sm font-medium">
							{t('email')}
						</label>
						<Input
							id="email"
							type="email"
							placeholder="you@example.com"
							value={form.email}
							onChange={(e) => setEmail(e.target.value)}
							disabled={isLoading}
							autoComplete="email"
							className="h-12"
							required
						/>
					</div>

					{/* Password */}
					<div className="space-y-2">
						<div className="flex items-center justify-between">
							<label htmlFor="password" className="text-sm font-medium">
								{t('password')}
							</label>
							<Link href="/forgot-password" className="text-sm text-primary hover:underline">
								{t('forgotPassword')}
							</Link>
						</div>
						<div className="relative">
							<Input
								id="password"
								type={showPassword ? 'text' : 'password'}
								placeholder="••••••••"
								value={form.password}
								onChange={(e) => setPassword(e.target.value)}
								disabled={isLoading}
								autoComplete="current-password"
								className="h-12 pr-10"
								minLength={8}
								required
							/>
							<button
								type="button"
								onClick={() => setShowPassword(!showPassword)}
								className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
								tabIndex={-1}
							>
								{showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
							</button>
						</div>
					</div>

					{/* Error Message (form error or OAuth error) */}
					{(error || oauthError) && (
						<div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
							{error || oauthError?.message}
						</div>
					)}

					{/* Submit Button */}
					<Button type="submit" className="h-12 w-full text-base font-medium" disabled={isLoading}>
						{isLoading && !loadingProvider ? (
							<>
								<Loader2 className="mr-2 h-5 w-5 animate-spin" />
								{t('signingIn')}
							</>
						) : (
							tCommon('signIn')
						)}
					</Button>
				</form>

				{/* Sign Up Link */}
				<p className="text-center text-sm text-muted-foreground">
					{t('noAccount')}{' '}
					<Link href="/signup" className="font-medium text-primary hover:underline">
						{tCommon('signUp')}
					</Link>
				</p>
			</div>
		</div>
	)
}
