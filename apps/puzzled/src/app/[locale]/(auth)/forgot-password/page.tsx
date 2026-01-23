'use client'

import { ArrowLeft, Check, Loader2, Mail, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Link } from '@/lib/i18n/routing'
import { Button, GamepadIcon, Input } from '@sylphx/ui'
import { useForgotPasswordForm } from '@sylphx/sdk/react'

export default function ForgotPasswordPage() {
	const t = useTranslations('auth')

	const {
		form,
		setEmail,
		isLoading,
		error,
		success,
		handleSubmit,
	} = useForgotPasswordForm({
		redirectTo: '/reset-password',
	})

	// Success state - email sent
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
					<div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
						<Check className="h-8 w-8 text-primary" />
					</div>
					<div>
						<h1 className="text-2xl font-bold">{t('checkYourEmail')}</h1>
						<p className="mt-2 text-muted-foreground">
							{t('resetLinkSent')}
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
						<GamepadIcon size={32} className="text-primary" />
					</div>
					<h1 className="text-2xl font-bold tracking-tight">
						{t('forgotPasswordTitle')}
					</h1>
					<p className="mt-2 text-muted-foreground">
						{t('forgotPasswordDescription')}
					</p>
				</div>

				{/* Form */}
				<form onSubmit={handleSubmit} className="space-y-4">
					{/* Email */}
					<div className="space-y-2">
						<label htmlFor="email" className="text-sm font-medium">
							{t('email')}
						</label>
						<div className="relative">
							<Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
							<Input
								id="email"
								type="email"
								placeholder="you@example.com"
								value={form.email}
								onChange={(e) => setEmail(e.target.value)}
								disabled={isLoading}
								autoComplete="email"
								className="h-12 pl-10"
								required
							/>
						</div>
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
						disabled={isLoading}
					>
						{isLoading ? (
							<>
								<Loader2 className="mr-2 h-5 w-5 animate-spin" />
								{t('sending')}
							</>
						) : (
							t('sendResetLink')
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
