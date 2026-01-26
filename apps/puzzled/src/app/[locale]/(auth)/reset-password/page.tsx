'use client'

import { useResetPasswordForm } from '@sylphx/sdk/react'
import { Button, GamepadIcon, Input } from '@sylphx/ui'
import { ArrowLeft, Check, Eye, EyeOff, Loader2, X } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Suspense, useMemo } from 'react'
import { Link } from '@/lib/i18n/routing'

// Password strength calculation (reused from signup)
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

export default function ResetPasswordPage() {
	return (
		<Suspense
			fallback={
				<div className="flex min-h-screen flex-col items-center justify-center px-4">
					<Loader2 className="h-8 w-8 animate-spin text-primary" />
				</div>
			}
		>
			<ResetPasswordContent />
		</Suspense>
	)
}

function ResetPasswordContent() {
	const t = useTranslations('auth')
	const searchParams = useSearchParams()
	const token = searchParams.get('token') || ''

	const {
		form,
		setPassword,
		setConfirmPassword,
		showPassword,
		toggleShowPassword,
		passwordsMatch,
		isValid,
		isLoading,
		error,
		success,
		handleSubmit,
	} = useResetPasswordForm({
		token,
		minPasswordLength: 8,
		afterResetUrl: '/login',
	})

	const passwordStrength = useMemo(() => calculatePasswordStrength(form.password), [form.password])

	// Invalid token state
	if (!token) {
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
					<div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
						<X className="h-8 w-8 text-destructive" />
					</div>
					<div>
						<h1 className="text-2xl font-bold">{t('invalidResetLink')}</h1>
						<p className="mt-2 text-muted-foreground">{t('invalidResetLinkDescription')}</p>
					</div>
					<Link href="/forgot-password">
						<Button className="w-full">{t('requestNewLink')}</Button>
					</Link>
				</div>
			</div>
		)
	}

	// Success state
	if (success) {
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
					<div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
						<Check className="h-8 w-8 text-green-500" />
					</div>
					<div>
						<h1 className="text-2xl font-bold">{t('passwordResetSuccess')}</h1>
						<p className="mt-2 text-muted-foreground">{t('passwordResetSuccessDescription')}</p>
					</div>
					<Link href="/login">
						<Button className="w-full">{t('backToLogin')}</Button>
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
					<h1 className="text-2xl font-bold tracking-tight">{t('resetPasswordTitle')}</h1>
					<p className="mt-2 text-muted-foreground">{t('resetPasswordDescription')}</p>
				</div>

				{/* Form */}
				<form onSubmit={handleSubmit} className="space-y-4">
					{/* New Password */}
					<div className="space-y-2">
						<label htmlFor="password" className="text-sm font-medium">
							{t('newPassword')}
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
								onClick={toggleShowPassword}
								className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
								tabIndex={-1}
							>
								{showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
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

					{/* Confirm Password */}
					<div className="space-y-2">
						<label htmlFor="confirmPassword" className="text-sm font-medium">
							{t('confirmPassword')}
						</label>
						<Input
							id="confirmPassword"
							type={showPassword ? 'text' : 'password'}
							placeholder="••••••••"
							value={form.confirmPassword}
							onChange={(e) => setConfirmPassword(e.target.value)}
							disabled={isLoading}
							autoComplete="new-password"
							className="h-12"
							minLength={8}
							required
						/>
						{form.confirmPassword && !passwordsMatch && (
							<p className="text-xs text-destructive">{t('passwordsDoNotMatch')}</p>
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
						disabled={isLoading || !isValid}
					>
						{isLoading ? (
							<>
								<Loader2 className="mr-2 h-5 w-5 animate-spin" />
								{t('resetting')}
							</>
						) : (
							t('resetPassword')
						)}
					</Button>
				</form>

				{/* Back to Login Link */}
				<p className="text-center">
					<Link
						href="/login"
						className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
					>
						<ArrowLeft className="h-4 w-4" />
						{t('backToLogin')}
					</Link>
				</p>
			</div>
		</div>
	)
}
