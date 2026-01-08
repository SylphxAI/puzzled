'use client'

import { Loader2, Mail, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { signIn } from '@/features/auth'
import { SocialLoginButtons } from '@/features/auth/components'
import { Link } from '@/lib/i18n/routing'
import { Button, GamepadIcon } from '@/shared/components/ui'

export default function LoginPage() {
	const t = useTranslations('auth')
	const router = useRouter()
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState('')

	const handleEmailLogin = async (e: React.FormEvent) => {
		e.preventDefault()
		setLoading(true)
		setError('')

		try {
			const result = await signIn.email({
				email,
				password,
			})

			if (result.error) {
				setError(result.error.message || 'Login failed')
			} else {
				router.push('/')
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
					<p className="text-muted-foreground">{t('signInTitle')}</p>
				</div>

				{/* Error message */}
				{error && (
					<div className="rounded-lg bg-wrong/10 p-3 text-center text-sm text-wrong">{error}</div>
				)}

				{/* Email form */}
				<form onSubmit={handleEmailLogin} className="space-y-4">
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
					</div>

					<div className="text-right">
						<Link href="/forgot-password" className="text-sm text-primary hover:underline">
							{t('forgotPassword')}
						</Link>
					</div>

					<Button type="submit" className="w-full" disabled={loading}>
						{loading ? (
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
						) : (
							<Mail className="mr-2 h-4 w-4" />
						)}
						{t('signIn')}
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

				{/* Sign up link */}
				<p className="text-center text-sm text-muted-foreground">
					{t('noAccount')}{' '}
					<Link href="/signup" className="text-primary hover:underline">
						{t('signUp')}
					</Link>
				</p>
			</div>
		</div>
	)
}
