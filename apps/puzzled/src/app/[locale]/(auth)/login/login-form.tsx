'use client'

import { useTranslations } from 'next-intl'
import type { FormEvent } from 'react'
import { useRef, useState } from 'react'
import { Link } from '@/lib/i18n/routing'
import { type OAuthProvider, useSafeAuth, useSignInForm } from '@/lib/identity/react'
import {
	AuthField,
	AuthSubmit,
	emailProblem,
	FormAlert,
	OAuthButtons,
	PasswordField,
	passwordProblem,
} from '../_components/auth-fields'

type OAuthSignInProvider = NonNullable<
	Parameters<NonNullable<ReturnType<typeof useSafeAuth>['signInWithOAuth']>>[0]
>['provider']

interface LoginFormProps {
	providers: OAuthProvider[]
}

export function LoginForm({ providers }: LoginFormProps) {
	const t = useTranslations('auth')
	const tCommon = useTranslations('common')
	const [touched, setTouched] = useState<{ email?: boolean; password?: boolean }>({})
	const [attempted, setAttempted] = useState(false)
	// Submission guard that survives two clicks in the same tick: `isLoading`
	// only flips after a re-render, so the ref is what actually blocks the
	// second submit while the first request is in flight.
	const submittingRef = useRef(false)
	const { signInWithOAuth } = useSafeAuth()

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
		// OAuth goes straight to the provider: no platform hop in between.
		oauthHandler: async (provider: string) => {
			await signInWithOAuth?.({ provider: provider as OAuthSignInProvider, redirectUrl: '/' })
		},
	})

	const emailIssue = emailProblem(form.email)
	const passwordIssue = passwordProblem(form.password)
	const emailError = (attempted || touched.email) && emailIssue ? t(emailIssue) : undefined
	const passwordError =
		(attempted || touched.password) && passwordIssue ? t(passwordIssue) : undefined

	// Inline validation guards obvious mistakes before a round trip. The server
	// stays the authority on whether the credentials are right.
	function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		if (submittingRef.current || isLoading) return
		setAttempted(true)
		if (emailIssue || passwordIssue) return
		submittingRef.current = true
		void handlePasswordSubmit(event).finally(() => {
			submittingRef.current = false
		})
	}

	return (
		<div className="surface-card p-5 sm:p-7">
			<h1 className="font-display text-2xl">{t('welcomeBack')}</h1>
			<p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
				{t('signInToContinue')}
			</p>

			<div className="mt-6">
				<OAuthButtons
					providers={providers}
					onSelect={handleOAuthSignIn}
					disabled={isLoading}
					loadingProvider={loadingProvider}
				/>
			</div>

			<form onSubmit={handleSubmit} noValidate className="mt-5 space-y-4">
				<AuthField
					id="email"
					label={t('email')}
					type="email"
					value={form.email}
					onChange={setEmail}
					onBlur={() => setTouched((state) => ({ ...state, email: true }))}
					autoComplete="email"
					placeholder="you@example.com"
					disabled={isLoading}
					error={emailError}
					required
					enterKeyHint="next"
				/>

				<PasswordField
					id="password"
					label={t('password')}
					value={form.password}
					onChange={setPassword}
					onBlur={() => setTouched((state) => ({ ...state, password: true }))}
					autoComplete="current-password"
					disabled={isLoading}
					error={passwordError}
					required
					enterKeyHint="done"
				/>

				<div className="flex justify-end">
					<Link
						href="/forgot-password"
						className="inline-flex min-h-11 items-center rounded-lg px-1 text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
					>
						{t('forgotPassword')}
					</Link>
				</div>

				<FormAlert message={error ? t('signInError') : null} />

				<AuthSubmit pending={isLoading} pendingLabel={t('signingIn')} label={tCommon('signIn')} />
			</form>

			<p className="mt-6 text-center text-sm text-muted-foreground">
				{t('noAccount')}{' '}
				<Link href="/signup" className="font-semibold text-primary hover:underline">
					{tCommon('signUp')}
				</Link>
			</p>
		</div>
	)
}
