'use client'

import { Loader2, Mail, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { signUp, validatePassword } from '@/features/auth'
import { PasswordStrength, SocialLoginButtons } from '@/features/auth/components'
import { Link } from '@/lib/i18n/routing'
import { Button, GamepadIcon } from '@/shared/components/ui'

export default function SignUpPage() {
	const t = useTranslations('auth')
	const tPassword = useTranslations('auth.passwordStrength')
	const tCommon = useTranslations('common')
	const router = useRouter()
	const [name, setName] = useState('')
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [confirmPassword, setConfirmPassword] = useState('')
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState('')

	const handleSignUp = async (e: React.FormEvent) => {
		e.preventDefault()
		setLoading(true)
		setError('')

		if (password !== confirmPassword) {
			setError(t('passwordsDoNotMatch'))
			setLoading(false)
			return
		}

		// Validate password against security policy
		const validation = validatePassword(password)
		if (!validation.isValid && validation.errors[0]) {
			setError(tPassword(validation.errors[0]))
			setLoading(false)
			return
		}

		try {
			const result = await signUp.email({
				email,
				password,
				name,
			})

			if (result.error) {
				setError(result.error.message || 'Sign up failed')
			} else {
				// Redirect to verify email page
				router.push(`/verify-email?email=${encodeURIComponent(email)}`)
			}
		} catch {
			setError('An error occurred')
		} finally {
			setLoading(false)
		}
	}

	return (
		<div className="relative flex min-h-screen flex-col items-center justify-center px-4">
			{/* Close button for PWA navigation */}
			<Link
				href="/"
				className="absolute right-4 top-4 rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
				aria-label={t('close')}
			>
				<X className="h-6 w-6" />
			</Link>

			<div className="w-full max-w-sm space-y-6">
				{/* Logo */}
				<div className="text-center">
					<h1 className="mb-2 flex items-center justify-center gap-2 text-2xl font-bold">
						<GamepadIcon size={28} className="text-primary" />
						Puzzled
					</h1>
					<p className="text-muted-foreground">{t('signUpTitle')}</p>
				</div>

				{/* Error message */}
				{error && (
					<div className="rounded-lg bg-wrong/10 p-3 text-center text-sm text-wrong">{error}</div>
				)}

				{/* Sign up form */}
				<form onSubmit={handleSignUp} className="space-y-4">
					<div>
						<label htmlFor="name" className="mb-1 block text-sm font-medium">
							Name
						</label>
						<input
							id="name"
							type="text"
							value={name}
							onChange={(e) => setName(e.target.value)}
							className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
							placeholder="Your name"
							required
						/>
					</div>

					<div>
						<label htmlFor="email" className="mb-1 block text-sm font-medium">
							{t('email')}
						</label>
						<input
							id="email"
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
							placeholder="you@example.com"
							required
						/>
					</div>

					<div>
						<label htmlFor="password" className="mb-1 block text-sm font-medium">
							{t('password')}
						</label>
						<input
							id="password"
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
							placeholder="••••••••"
							required
						/>
						<PasswordStrength password={password} />
					</div>

					<div>
						<label htmlFor="confirmPassword" className="mb-1 block text-sm font-medium">
							{t('confirmPassword')}
						</label>
						<input
							id="confirmPassword"
							type="password"
							value={confirmPassword}
							onChange={(e) => setConfirmPassword(e.target.value)}
							className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
							placeholder="••••••••"
							required
						/>
					</div>

					<Button type="submit" className="w-full" disabled={loading}>
						{loading ? (
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
						) : (
							<Mail className="mr-2 h-4 w-4" />
						)}
						{tCommon('signUp')}
					</Button>
				</form>

				{/* Divider */}
				<div className="relative">
					<div className="absolute inset-0 flex items-center">
						<div className="w-full border-t" />
					</div>
					<div className="relative flex justify-center text-xs uppercase">
						<span className="bg-background px-2 text-muted-foreground">{t('orContinueWith')}</span>
					</div>
				</div>

				{/* Social login - shows only enabled providers */}
				<SocialLoginButtons disabled={loading} />

				{/* Sign in link */}
				<p className="text-center text-sm text-muted-foreground">
					{t('hasAccount')}{' '}
					<Link href="/login" className="text-primary hover:underline">
						{tCommon('signIn')}
					</Link>
				</p>
			</div>
		</div>
	)
}
