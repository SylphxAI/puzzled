'use client'

import { Check, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { getPasswordStrength, getStrengthLabel, validatePassword } from '../lib/password-validation'

interface PasswordStrengthProps {
	password: string
	showRequirements?: boolean
	className?: string
}

/**
 * Password strength indicator component (SSOT)
 * Shows visual strength meter and requirements checklist
 * Uses semantic theme colors for proper dark mode support
 */
export function PasswordStrength({
	password,
	showRequirements = true,
	className,
}: PasswordStrengthProps) {
	const t = useTranslations('auth.passwordStrength')

	const validation = useMemo(() => validatePassword(password), [password])
	const strength = useMemo(() => getPasswordStrength(password), [password])
	const strengthLabel = getStrengthLabel(strength)

	// Semantic color mapping for theme consistency
	const strengthColors = {
		0: 'bg-destructive',
		1: 'bg-destructive',
		2: 'bg-yellow-500',
		3: 'bg-correct',
		4: 'bg-correct',
	} as const

	if (!password) return null

	return (
		<div className={cn('space-y-3', className)}>
			{/* Strength meter bar */}
			<div className="space-y-1.5">
				<div className="flex justify-between text-xs">
					<span className="text-muted-foreground">{t('label')}</span>
					<span
						className={cn(
							'font-medium',
							strength >= 3 && 'text-correct',
							strength === 2 && 'text-yellow-600 dark:text-yellow-400',
							strength < 2 && 'text-destructive',
						)}
					>
						{t(strengthLabel)}
					</span>
				</div>
				<div className="flex gap-1">
					{[0, 1, 2, 3].map((index) => (
						<div
							key={index}
							className={cn(
								'h-1.5 flex-1 rounded-full transition-colors',
								index < strength
									? strengthColors[strength as keyof typeof strengthColors]
									: 'bg-muted',
							)}
						/>
					))}
				</div>
			</div>

			{/* Requirements checklist */}
			{showRequirements && (
				<ul className="space-y-1 text-xs" aria-label={t('requirementsLabel')}>
					<RequirementItem met={validation.checks.minLength} label={t('minLength')} />
					<RequirementItem met={validation.checks.hasUppercase} label={t('uppercase')} />
					<RequirementItem met={validation.checks.hasLowercase} label={t('lowercase')} />
					<RequirementItem met={validation.checks.hasNumber} label={t('number')} />
					<RequirementItem met={validation.checks.hasSpecial} label={t('special')} />
				</ul>
			)}
		</div>
	)
}

function RequirementItem({ met, label }: { met: boolean; label: string }) {
	return (
		<li
			className={cn(
				'flex items-center gap-2 transition-colors',
				met ? 'text-correct' : 'text-muted-foreground',
			)}
		>
			{met ? <Check className="h-3 w-3 flex-shrink-0" /> : <X className="h-3 w-3 flex-shrink-0" />}
			<span>{label}</span>
		</li>
	)
}
