'use client'

import { Check, Eye, EyeOff, Loader2, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, useMemo } from 'react'
import { Link } from '@/lib/i18n/routing'
import { Button, GamepadIcon, Input } from '@sylphx/ui'
import { useSignUpForm, useOAuthProviders, OAuthIcons } from '@sylphx/sdk/react'

// Password strength calculation
function calculatePasswordStrength(password: string): {
	score: number
	label: string
	color: string
	checks: { met: boolean; label: string }[]
} {
	const checks = [
		{ met: password.length >= 8, label: 'minLength' },
		{ met: /[a-z]/.test(password), label: 'lowercase' },
		{ met: /[A-Z]/.test(password), label: 'uppercase' },
		{ met: /[0-9]/.test(password), label: 'number' },
		{ met: /[!@#$%^&*(),.?":{}|<>]/.test(password), label: 'special' },
	]

	const score = checks.filter((c) => c.met).length

	const strengthMap: Record<number, { label: string; color: string }> = {
		0: { label: 'veryWeak', color: 'bg-destructive' },
		1: { label: 'weak', color: 'bg-destructive' },
		2: { label: 'fair', color: 'bg-amber-500' },
		3: { label: 'fair', color: 'bg-amber-500' },
		4: { label: 'strong', color: 'bg-green-500' },
		5: { label: 'veryStrong', color: 'bg-green-600' },
	}

	return { score, ...strengthMap[score], checks }
}

export default function SignUpPage() {
	const t = useTranslations('auth')
	const tCommon = useTranslations('common')
	const [showPassword, setShowPassword] = useState(false)

	// Fetch enabled OAuth providers from platform
	const { providers, isLoading: providersLoading } = useOAuthProviders()

	const {
		form,
		setName,
		setEmail,
		setPassword,
		step,
		isLoading,
		loadingProvider,
		error,
		passwordValid,
		handleSubmit,
		handleOAuthSignUp,
	} = useSignUpForm({
		providers,
		afterSignUpUrl: '/',
		minPasswordLength: 8,
	})

	const passwordStrength = useMemo(
		() => calculatePasswordStrength(form.password),
		[form.password]
	)

	// Email verification step
	if (step === 'verify-email') {
		return (
			<div className="relative flex min-h-screen flex-col items-center justify-center px-4">
				<Link
					href="/"
					className="absolute right-4 top-4 rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
					aria-label={t('close')}
				>
					<X className="h-6 w-6" />
				</Link>

				<div className="w-full max-w-[400px] space-y-6 text-center">
					<div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
						<Check className="h-8 w-8 text-primary" />
					</div>
					<div>
						<h1 className="text-2xl font-bold">{t('checkYourEmail')}</h1>
						<p className="mt-2 text-muted-foreground">
							{t('verificationSent')}
						</p>
					</div>
					<Link href="/login">
						<Button variant="outline" className="w-full">
							{t('backToLogin')}
						</Button>
					</Link>
				</div>
			</div>
		)
	}

	return (
		<div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-8">
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
					<h1 className="text-2xl font-bold tracking-tight">
						{t('createAccount')}
					</h1>
					<p className="mt-2 text-muted-foreground">
						{t('joinToContinue')}
					</p>
				</div>

				{/* OAuth Buttons - only show if providers are enabled */}
				{providersLoading ? (
					<div className="space-y-3">
						<div className="h-12 w-full animate-pulse rounded-md bg-muted" />
						<div className="h-12 w-full animate-pulse rounded-md bg-muted" />
					</div>
				) : providers.length > 0 ? (
					<>
						<div className="space-y-3">
							{providers.map((provider) => {
								const Icon = OAuthIcons[provider]
								const isProviderLoading = loadingProvider === provider
								return (
									<Button
										key={provider}
										variant="outline"
										className="relative h-12 w-full gap-3 text-base font-medium"
										onClick={() => handleOAuthSignUp(provider)}
										disabled={isLoading}
									>
										{isProviderLoading ? (
											<Loader2 className="h-5 w-5 animate-spin" />
										) : (
											<Icon className="h-5 w-5" />
										)}
										{t('continueWith', { provider: provider.charAt(0).toUpperCase() + provider.slice(1) })}
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
				) : null}

				{/* Email/Password Form */}
				<form onSubmit={handleSubmit} className="space-y-4">
					{/* Name */}
					<div className="space-y-2">
						<label htmlFor="name" className="text-sm font-medium">
							Name
						</label>
						<Input
							id="name"
							type="text"
							placeholder="Your name"
							value={form.name}
							onChange={(e) => setName(e.target.value)}
							disabled={isLoading}
							autoComplete="name"
							className="h-12"
							required
						/>
					</div>

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
						<label htmlFor="password" className="text-sm font-medium">
							{t('password')}
						</label>
						<div className="relative">
							<Input
								id="password"
								type={showPassword ? 'text' : 'password'}
								placeholder="••••••••"
								value={form.password}
								onChange={(e) => setPassword(e.target.value)}
								disabled={isLoading}
								autoComplete="new-password"
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
								{showPassword ? (
									<EyeOff className="h-5 w-5" />
								) : (
									<Eye className="h-5 w-5" />
								)}
							</button>
						</div>

						{/* Password Strength Indicator */}
						{form.password && (
							<div className="space-y-2">
								<div className="flex items-center gap-2">
									<div className="flex-1">
										<div className="h-1.5 w-full rounded-full bg-muted">
											<div
												className={`h-full rounded-full transition-all ${passwordStrength.color}`}
												style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
											/>
										</div>
									</div>
									<span className="text-xs text-muted-foreground">
										{t(`passwordStrength.${passwordStrength.label}`)}
									</span>
								</div>
								<div className="grid grid-cols-2 gap-1 text-xs">
									{passwordStrength.checks.map((check) => (
										<div
											key={check.label}
											className={`flex items-center gap-1 ${
												check.met ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'
											}`}
										>
											<Check className={`h-3 w-3 ${check.met ? '' : 'opacity-30'}`} />
											{t(`passwordStrength.${check.label}`)}
										</div>
									))}
								</div>
							</div>
						)}
					</div>

					{/* Error Message */}
					{error && (
						<div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
							{error}
						</div>
					)}

					{/* Submit Button */}
					<Button
						type="submit"
						className="h-12 w-full text-base font-medium"
						disabled={isLoading || !passwordValid}
					>
						{isLoading && !loadingProvider ? (
							<>
								<Loader2 className="mr-2 h-5 w-5 animate-spin" />
								{t('signingUp')}
							</>
						) : (
							tCommon('signUp')
						)}
					</Button>

					{/* Terms */}
					<p className="text-center text-xs text-muted-foreground">
						By signing up, you agree to our{' '}
						<Link href="/terms" className="text-primary hover:underline">
							Terms of Service
						</Link>{' '}
						and{' '}
						<Link href="/privacy" className="text-primary hover:underline">
							Privacy Policy
						</Link>
					</p>
				</form>

				{/* Sign In Link */}
				<p className="text-center text-sm text-muted-foreground">
					{t('hasAccount')}{' '}
					<Link href="/login" className="font-medium text-primary hover:underline">
						{tCommon('signIn')}
					</Link>
				</p>
			</div>
		</div>
	)
}
