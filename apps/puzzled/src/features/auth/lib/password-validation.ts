/**
 * Password Policy Configuration
 *
 * Enforces strong password requirements:
 * - Minimum 8 characters
 * - At least 1 uppercase letter
 * - At least 1 lowercase letter
 * - At least 1 number
 * - At least 1 special character
 */

export interface PasswordValidationResult {
	isValid: boolean
	errors: string[]
	checks: {
		minLength: boolean
		hasUppercase: boolean
		hasLowercase: boolean
		hasNumber: boolean
		hasSpecial: boolean
	}
}

export const PASSWORD_REQUIREMENTS = {
	minLength: 8,
	requireUppercase: true,
	requireLowercase: true,
	requireNumber: true,
	requireSpecial: true,
} as const

const SPECIAL_CHARS = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/

/**
 * Validate password against security policy
 */
export function validatePassword(password: string): PasswordValidationResult {
	const checks = {
		minLength: password.length >= PASSWORD_REQUIREMENTS.minLength,
		hasUppercase: /[A-Z]/.test(password),
		hasLowercase: /[a-z]/.test(password),
		hasNumber: /[0-9]/.test(password),
		hasSpecial: SPECIAL_CHARS.test(password),
	}

	const errors: string[] = []

	if (!checks.minLength) {
		errors.push('passwordMinLength')
	}
	if (PASSWORD_REQUIREMENTS.requireUppercase && !checks.hasUppercase) {
		errors.push('passwordNeedsUppercase')
	}
	if (PASSWORD_REQUIREMENTS.requireLowercase && !checks.hasLowercase) {
		errors.push('passwordNeedsLowercase')
	}
	if (PASSWORD_REQUIREMENTS.requireNumber && !checks.hasNumber) {
		errors.push('passwordNeedsNumber')
	}
	if (PASSWORD_REQUIREMENTS.requireSpecial && !checks.hasSpecial) {
		errors.push('passwordNeedsSpecial')
	}

	return {
		isValid: errors.length === 0,
		errors,
		checks,
	}
}

/**
 * Get password strength score (0-4)
 * 0 = Very Weak, 1 = Weak, 2 = Fair, 3 = Strong, 4 = Very Strong
 */
export function getPasswordStrength(password: string): number {
	if (!password) return 0

	let score = 0
	const { checks } = validatePassword(password)

	// Base score from checks
	if (checks.minLength) score += 1
	if (checks.hasUppercase && checks.hasLowercase) score += 1
	if (checks.hasNumber) score += 1
	if (checks.hasSpecial) score += 1

	// Bonus for length
	if (password.length >= 12) score = Math.min(score + 1, 4)

	return Math.min(score, 4)
}

/**
 * Get strength label for display
 */
export function getStrengthLabel(
	strength: number,
): 'veryWeak' | 'weak' | 'fair' | 'strong' | 'veryStrong' {
	switch (strength) {
		case 0:
			return 'veryWeak'
		case 1:
			return 'weak'
		case 2:
			return 'fair'
		case 3:
			return 'strong'
		case 4:
			return 'veryStrong'
		default:
			return 'veryWeak'
	}
}
