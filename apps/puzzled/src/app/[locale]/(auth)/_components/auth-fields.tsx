'use client'

import { Button, Input, OAuthIcons } from '@sylphx/ui'
import { Check, Eye, EyeOff, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { type ReactNode, useState } from 'react'
import { cn } from '@/lib/utils'

type ProviderIcon = (props: { className?: string; 'aria-hidden'?: boolean | 'true' }) => ReactNode

const PROVIDER_ICONS: Record<string, ProviderIcon> = OAuthIcons

/**
 * Field primitives shared by sign-in, sign-up and recovery.
 *
 * Each control keeps its label bound to the input, carries `autocomplete` so a
 * password manager can fill it, and reports its own problem through the
 * described-by region the design system wires up.
 */

export const MIN_PASSWORD_LENGTH = 8

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function emailProblem(value: string): 'emailRequired' | 'emailInvalid' | null {
	const trimmed = value.trim()
	if (!trimmed) return 'emailRequired'
	return EMAIL_PATTERN.test(trimmed) ? null : 'emailInvalid'
}

export function passwordProblem(
	value: string,
	minLength = MIN_PASSWORD_LENGTH,
): 'passwordRequired' | 'passwordTooShort' | null {
	if (!value) return 'passwordRequired'
	return value.length >= minLength ? null : 'passwordTooShort'
}

export function AuthField({
	id,
	label,
	value,
	onChange,
	onBlur,
	autoComplete,
	type = 'text',
	placeholder,
	disabled,
	hint,
	error,
	enterKeyHint,
	required,
}: {
	id: string
	label: string
	value: string
	onChange: (value: string) => void
	onBlur?: () => void
	autoComplete: string
	type?: string
	placeholder?: string
	disabled?: boolean
	hint?: string
	error?: string
	enterKeyHint?: 'enter' | 'next' | 'done' | 'go'
	required?: boolean
}) {
	return (
		<div>
			<label htmlFor={id} className="mb-1.5 block text-sm font-semibold">
				{label}
			</label>
			<Input
				id={id}
				type={type}
				value={value}
				onChange={(event) => onChange(event.target.value)}
				onBlur={onBlur}
				autoComplete={autoComplete}
				placeholder={placeholder}
				disabled={disabled}
				enterKeyHint={enterKeyHint}
				required={required}
				className="h-12"
				error={error}
				helperText={hint}
			/>
		</div>
	)
}

export function PasswordField({
	id,
	label,
	value,
	onChange,
	onBlur,
	autoComplete,
	disabled,
	hint,
	error,
	showStrength = false,
	enterKeyHint,
	required,
}: {
	id: string
	label: string
	value: string
	onChange: (value: string) => void
	onBlur?: () => void
	autoComplete: 'new-password' | 'current-password'
	disabled?: boolean
	hint?: string
	error?: string
	showStrength?: boolean
	enterKeyHint?: 'enter' | 'next' | 'done' | 'go'
	required?: boolean
}) {
	const t = useTranslations('auth')
	const [visible, setVisible] = useState(false)

	return (
		<div>
			<label htmlFor={id} className="mb-1.5 block text-sm font-semibold">
				{label}
			</label>
			<div className="relative">
				<Input
					id={id}
					type={visible ? 'text' : 'password'}
					value={value}
					onChange={(event) => onChange(event.target.value)}
					onBlur={onBlur}
					autoComplete={autoComplete}
					placeholder="••••••••"
					disabled={disabled}
					enterKeyHint={enterKeyHint}
					required={required}
					className="h-12 pr-14"
					error={error}
					helperText={hint}
				/>
				<button
					type="button"
					onClick={() => setVisible((current) => !current)}
					aria-pressed={visible}
					aria-label={visible ? t('hidePassword') : t('showPassword')}
					className="absolute right-1 top-0 flex h-12 w-12 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
				>
					{visible ? (
						<EyeOff className="h-5 w-5" aria-hidden="true" />
					) : (
						<Eye className="h-5 w-5" aria-hidden="true" />
					)}
				</button>
			</div>
			{showStrength && value ? <PasswordStrength value={value} /> : null}
		</div>
	)
}

/** Strength is stated in words as well as fill, never by colour alone. */
function PasswordStrength({ value }: { value: string }) {
	const t = useTranslations('auth')
	const checks = [
		{ key: 'minLength', met: value.length >= MIN_PASSWORD_LENGTH },
		{ key: 'lowercase', met: /[a-z]/.test(value) },
		{ key: 'uppercase', met: /[A-Z]/.test(value) },
		{ key: 'number', met: /[0-9]/.test(value) },
		{ key: 'special', met: /[!@#$%^&*(),.?":{}|<>]/.test(value) },
	] as const
	const score = checks.filter((check) => check.met).length
	const labels = ['veryWeak', 'weak', 'fair', 'fair', 'strong', 'veryStrong'] as const

	return (
		<div className="mt-2 space-y-2">
			<div className="flex items-center gap-2">
				<div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
					<div
						className={cn(
							'h-full rounded-full transition-all',
							score <= 1 && 'bg-destructive',
							score > 1 && score <= 3 && 'bg-amber-500',
							score >= 4 && 'bg-emerald-500',
						)}
						style={{ width: `${(score / 5) * 100}%` }}
					/>
				</div>
				<span className="text-xs font-medium text-muted-foreground">
					{t('passwordStrength.label')}: {t(`passwordStrength.${labels[score]}`)}
				</span>
			</div>
			<ul className="grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
				{checks.map((check) => (
					<li key={check.key} className="flex items-center gap-1.5">
						<Check
							className={cn(
								'h-3.5 w-3.5 shrink-0',
								check.met ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground/50',
							)}
							aria-hidden="true"
						/>
						<span className={check.met ? 'text-foreground' : 'text-muted-foreground'}>
							{t(`passwordStrength.${check.key}`)}
						</span>
						<span className="sr-only">
							{check.met ? t('passwordStrength.met') : t('passwordStrength.unmet')}
						</span>
					</li>
				))}
			</ul>
		</div>
	)
}

/**
 * Providers the app has actually configured.
 *
 * An empty list renders nothing: a sign-in button for a provider nobody can
 * use would be a promise the product cannot keep.
 */
export function OAuthButtons({
	providers,
	onSelect,
	disabled,
	loadingProvider,
}: {
	providers: readonly string[]
	onSelect: (provider: string) => void
	disabled?: boolean
	loadingProvider?: string | null
}) {
	const t = useTranslations('auth')
	if (providers.length === 0) return null

	return (
		<div className="space-y-3">
			{providers.map((provider) => {
				const Icon = PROVIDER_ICONS[provider] ?? PROVIDER_ICONS.google
				const name = provider.charAt(0).toUpperCase() + provider.slice(1)
				return (
					<Button
						key={provider}
						type="button"
						variant="outline"
						className="h-12 w-full gap-3 text-base font-medium"
						onClick={() => onSelect(provider)}
						disabled={disabled}
					>
						{loadingProvider === provider ? (
							<Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
						) : (
							<Icon className="h-5 w-5" aria-hidden="true" />
						)}
						{t('continueWith', { provider: name })}
					</Button>
				)
			})}
			<Divider label={t('orContinueWith')} />
		</div>
	)
}

export function Divider({ label }: { label: string }) {
	return (
		<div className="flex items-center gap-3">
			<span className="h-px flex-1 bg-border" aria-hidden="true" />
			<span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
			<span className="h-px flex-1 bg-border" aria-hidden="true" />
		</div>
	)
}

/** Form-level status: announced politely, never colour-only. */
export function FormAlert({ message }: { message?: string | null }) {
	return (
		<output aria-live="polite" className="block">
			{message ? (
				<p className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
					{message}
				</p>
			) : null}
		</output>
	)
}

export function AuthSubmit({
	pending,
	pendingLabel,
	label,
	disabled,
}: {
	pending: boolean
	pendingLabel: string
	label: string
	disabled?: boolean
}) {
	return (
		<Button
			type="submit"
			className="h-12 w-full text-base font-semibold"
			disabled={pending || disabled}
		>
			{pending ? (
				<>
					<Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden="true" />
					{pendingLabel}
				</>
			) : (
				label
			)}
		</Button>
	)
}
