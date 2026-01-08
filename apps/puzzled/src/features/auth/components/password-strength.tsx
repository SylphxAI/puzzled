'use client'

import { useTranslations } from 'next-intl'
import {
	PasswordStrength as BasePasswordStrength,
	type PasswordStrengthLabels,
} from '@sylphx/auth/components'

interface PasswordStrengthProps {
	password: string
	showRequirements?: boolean
	className?: string
}

/**
 * Password strength indicator with i18n support
 * Wrapper around @sylphx/auth/components/PasswordStrength
 */
export function PasswordStrength({
	password,
	showRequirements = true,
	className,
}: PasswordStrengthProps) {
	const t = useTranslations('auth.passwordStrength')

	const labels: PasswordStrengthLabels = {
		label: t('label'),
		requirementsLabel: t('requirementsLabel'),
		strength: {
			weak: t('weak'),
			fair: t('fair'),
			good: t('good'),
			strong: t('strong'),
		},
		requirements: {
			minLength: t('minLength'),
			uppercase: t('uppercase'),
			lowercase: t('lowercase'),
			number: t('number'),
			special: t('special'),
		},
	}

	return (
		<BasePasswordStrength
			password={password}
			showRequirements={showRequirements}
			className={className}
			labels={labels}
		/>
	)
}
