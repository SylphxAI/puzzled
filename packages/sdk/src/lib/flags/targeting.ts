/**
 * Targeting Rules Evaluation
 *
 * Evaluates targeting conditions against user context.
 * Supports various operators for flexible targeting.
 */

import type { EvaluationContext, TargetingCondition, TargetingOperator, TargetingRule } from './types'

// ==========================================
// Condition Evaluation
// ==========================================

/**
 * Evaluate a single targeting condition
 */
export function evaluateCondition(condition: TargetingCondition, context: EvaluationContext): boolean {
	const attributeValue = getAttributeValue(condition.attribute, context)

	// Handle null/undefined attribute
	if (attributeValue === null || attributeValue === undefined) {
		// Only 'not_in' and 'not_contains' can match when attribute is missing
		if (condition.operator === 'not_in' || condition.operator === 'not_contains') {
			return true
		}
		return false
	}

	return evaluateOperator(condition.operator, attributeValue, condition.value)
}

/**
 * Evaluate all conditions in a rule (AND logic)
 */
export function evaluateRule(rule: TargetingRule, context: EvaluationContext): boolean {
	if (rule.conditions.length === 0) {
		return true // No conditions = always match
	}

	return rule.conditions.every((condition) => evaluateCondition(condition, context))
}

/**
 * Find the first matching rule from a list
 */
export function findMatchingRule(
	rules: TargetingRule[],
	context: EvaluationContext
): TargetingRule | null {
	for (const rule of rules) {
		if (evaluateRule(rule, context)) {
			return rule
		}
	}
	return null
}

// ==========================================
// Attribute Resolution
// ==========================================

/**
 * Get attribute value from context using dot notation
 *
 * Supports paths like:
 * - "userId"
 * - "device.type"
 * - "attributes.plan"
 * - "geo.country"
 */
export function getAttributeValue(path: string, context: EvaluationContext): unknown {
	// Handle top-level attributes first
	if (path in context && !path.includes('.')) {
		return context[path]
	}

	// Handle nested paths
	const parts = path.split('.')
	let value: unknown = context

	for (const part of parts) {
		if (value === null || value === undefined) {
			return undefined
		}
		if (typeof value !== 'object') {
			return undefined
		}
		value = (value as Record<string, unknown>)[part]
	}

	return value
}

// ==========================================
// Operator Evaluation
// ==========================================

/**
 * Evaluate a comparison operator
 */
export function evaluateOperator(operator: TargetingOperator, actual: unknown, expected: unknown): boolean {
	switch (operator) {
		case 'eq':
			return equals(actual, expected)

		case 'neq':
			return !equals(actual, expected)

		case 'gt':
			return compare(actual, expected) > 0

		case 'gte':
			return compare(actual, expected) >= 0

		case 'lt':
			return compare(actual, expected) < 0

		case 'lte':
			return compare(actual, expected) <= 0

		case 'contains':
			return contains(actual, expected)

		case 'not_contains':
			return !contains(actual, expected)

		case 'starts_with':
			return startsWith(actual, expected)

		case 'ends_with':
			return endsWith(actual, expected)

		case 'in':
			return isIn(actual, expected)

		case 'not_in':
			return !isIn(actual, expected)

		case 'regex':
			return matchesRegex(actual, expected)

		case 'semver_gt':
			return compareSemver(actual, expected) > 0

		case 'semver_gte':
			return compareSemver(actual, expected) >= 0

		case 'semver_lt':
			return compareSemver(actual, expected) < 0

		case 'semver_lte':
			return compareSemver(actual, expected) <= 0

		default:
			return false
	}
}

// ==========================================
// Comparison Helpers
// ==========================================

function equals(actual: unknown, expected: unknown): boolean {
	// Type coercion for common cases
	if (typeof actual === 'string' && typeof expected === 'number') {
		return actual === String(expected)
	}
	if (typeof actual === 'number' && typeof expected === 'string') {
		return String(actual) === expected
	}
	if (typeof actual === 'boolean' && typeof expected === 'string') {
		return actual === (expected === 'true')
	}

	return actual === expected
}

function compare(actual: unknown, expected: unknown): number {
	const numActual = Number(actual)
	const numExpected = Number(expected)

	if (!isNaN(numActual) && !isNaN(numExpected)) {
		return numActual - numExpected
	}

	// Fallback to string comparison
	const strActual = String(actual)
	const strExpected = String(expected)
	return strActual.localeCompare(strExpected)
}

function contains(actual: unknown, expected: unknown): boolean {
	if (typeof actual === 'string' && typeof expected === 'string') {
		return actual.toLowerCase().includes(expected.toLowerCase())
	}
	if (Array.isArray(actual)) {
		return actual.some((item) => equals(item, expected))
	}
	return false
}

function startsWith(actual: unknown, expected: unknown): boolean {
	if (typeof actual === 'string' && typeof expected === 'string') {
		return actual.toLowerCase().startsWith(expected.toLowerCase())
	}
	return false
}

function endsWith(actual: unknown, expected: unknown): boolean {
	if (typeof actual === 'string' && typeof expected === 'string') {
		return actual.toLowerCase().endsWith(expected.toLowerCase())
	}
	return false
}

function isIn(actual: unknown, expected: unknown): boolean {
	if (!Array.isArray(expected)) {
		return false
	}
	return expected.some((item) => equals(actual, item))
}

function matchesRegex(actual: unknown, expected: unknown): boolean {
	if (typeof actual !== 'string' || typeof expected !== 'string') {
		return false
	}
	try {
		const regex = new RegExp(expected, 'i')
		return regex.test(actual)
	} catch {
		return false
	}
}

// ==========================================
// Semver Comparison
// ==========================================

interface SemverParts {
	major: number
	minor: number
	patch: number
	prerelease: string[]
}

function parseSemver(version: unknown): SemverParts | null {
	if (typeof version !== 'string') return null

	const match = version.match(/^v?(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/)
	if (!match) return null

	return {
		major: parseInt(match[1]!, 10),
		minor: parseInt(match[2]!, 10),
		patch: parseInt(match[3]!, 10),
		prerelease: match[4] ? match[4].split('.') : [],
	}
}

function compareSemver(actual: unknown, expected: unknown): number {
	const actualParts = parseSemver(actual)
	const expectedParts = parseSemver(expected)

	if (!actualParts || !expectedParts) return 0

	// Compare major.minor.patch
	if (actualParts.major !== expectedParts.major) {
		return actualParts.major - expectedParts.major
	}
	if (actualParts.minor !== expectedParts.minor) {
		return actualParts.minor - expectedParts.minor
	}
	if (actualParts.patch !== expectedParts.patch) {
		return actualParts.patch - expectedParts.patch
	}

	// Prerelease versions have lower precedence
	if (actualParts.prerelease.length === 0 && expectedParts.prerelease.length > 0) {
		return 1 // Actual is release, expected is prerelease
	}
	if (actualParts.prerelease.length > 0 && expectedParts.prerelease.length === 0) {
		return -1 // Actual is prerelease, expected is release
	}

	// Compare prerelease identifiers
	const maxLen = Math.max(actualParts.prerelease.length, expectedParts.prerelease.length)
	for (let i = 0; i < maxLen; i++) {
		const actualPre = actualParts.prerelease[i]
		const expectedPre = expectedParts.prerelease[i]

		if (actualPre === undefined) return -1
		if (expectedPre === undefined) return 1

		const numActual = parseInt(actualPre, 10)
		const numExpected = parseInt(expectedPre, 10)

		if (!isNaN(numActual) && !isNaN(numExpected)) {
			if (numActual !== numExpected) return numActual - numExpected
		} else if (!isNaN(numActual)) {
			return -1 // Numbers have lower precedence than strings
		} else if (!isNaN(numExpected)) {
			return 1
		} else {
			const cmp = actualPre.localeCompare(expectedPre)
			if (cmp !== 0) return cmp
		}
	}

	return 0
}

// ==========================================
// Context Utilities
// ==========================================

/**
 * Merge context objects, with later objects taking precedence
 */
export function mergeContext(...contexts: (EvaluationContext | undefined)[]): EvaluationContext {
	const result: EvaluationContext = {}

	for (const ctx of contexts) {
		if (!ctx) continue

		for (const [key, value] of Object.entries(ctx)) {
			if (value === undefined) continue

			if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
				// Deep merge objects
				result[key] = {
					...(result[key] as Record<string, unknown> | undefined),
					...value,
				}
			} else {
				result[key] = value
			}
		}
	}

	return result
}

/**
 * Validate that required context fields are present
 */
export function validateContext(context: EvaluationContext): string[] {
	const errors: string[] = []

	// Must have at least one identifier
	if (!context.userId && !context.anonymousId) {
		errors.push('Context must have either userId or anonymousId for consistent bucketing')
	}

	return errors
}
