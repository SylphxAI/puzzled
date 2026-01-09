'use client'

import { X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Link } from '@/lib/i18n/routing'
import { GamepadIcon } from '@sylphx/ui'
import { SignUp } from '@sylphx/platform-sdk/react'

export default function SignUpPage() {
	const t = useTranslations('auth')
	const tCommon = useTranslations('common')

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

				{/* SDK Sign Up Form */}
				<SignUp
					mode="embedded"
					redirectUrl="/dashboard"
					providers={['google', 'github']}
					signInUrl="/login"
					termsUrl="/terms"
					privacyUrl="/privacy"
					showCard={false}
				/>

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
