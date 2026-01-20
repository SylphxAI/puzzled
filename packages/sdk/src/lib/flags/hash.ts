/**
 * Consistent Hashing for Feature Flags
 *
 * Uses MurmurHash3 for fast, consistent bucketing.
 * Ensures users always get the same variant.
 */

// ==========================================
// MurmurHash3 Implementation
// ==========================================

/**
 * MurmurHash3 (x86 32-bit)
 *
 * Fast, non-cryptographic hash with excellent distribution.
 * Used by most feature flag systems for consistent bucketing.
 */
export function murmurHash3(key: string, seed: number = 0): number {
	const remainder = key.length & 3 // key.length % 4
	const bytes = key.length - remainder
	let h1 = seed

	const c1 = 0xcc9e2d51
	const c2 = 0x1b873593

	let i = 0
	let k1: number

	while (i < bytes) {
		k1 =
			(key.charCodeAt(i) & 0xff) |
			((key.charCodeAt(++i) & 0xff) << 8) |
			((key.charCodeAt(++i) & 0xff) << 16) |
			((key.charCodeAt(++i) & 0xff) << 24)
		++i

		k1 = ((k1 & 0xffff) * c1 + ((((k1 >>> 16) * c1) & 0xffff) << 16)) & 0xffffffff
		k1 = (k1 << 15) | (k1 >>> 17)
		k1 = ((k1 & 0xffff) * c2 + ((((k1 >>> 16) * c2) & 0xffff) << 16)) & 0xffffffff

		h1 ^= k1
		h1 = (h1 << 13) | (h1 >>> 19)
		const h1b = ((h1 & 0xffff) * 5 + ((((h1 >>> 16) * 5) & 0xffff) << 16)) & 0xffffffff
		h1 = (h1b & 0xffff) + 0x6b64 + ((((h1b >>> 16) + 0xe654) & 0xffff) << 16)
	}

	k1 = 0

	switch (remainder) {
		case 3:
			k1 ^= (key.charCodeAt(i + 2) & 0xff) << 16
		// fallthrough
		case 2:
			k1 ^= (key.charCodeAt(i + 1) & 0xff) << 8
		// fallthrough
		case 1:
			k1 ^= key.charCodeAt(i) & 0xff
			k1 = ((k1 & 0xffff) * c1 + ((((k1 >>> 16) * c1) & 0xffff) << 16)) & 0xffffffff
			k1 = (k1 << 15) | (k1 >>> 17)
			k1 = ((k1 & 0xffff) * c2 + ((((k1 >>> 16) * c2) & 0xffff) << 16)) & 0xffffffff
			h1 ^= k1
	}

	h1 ^= key.length

	h1 ^= h1 >>> 16
	h1 = ((h1 & 0xffff) * 0x85ebca6b + ((((h1 >>> 16) * 0x85ebca6b) & 0xffff) << 16)) & 0xffffffff
	h1 ^= h1 >>> 13
	h1 = ((h1 & 0xffff) * 0xc2b2ae35 + ((((h1 >>> 16) * 0xc2b2ae35) & 0xffff) << 16)) & 0xffffffff
	h1 ^= h1 >>> 16

	return h1 >>> 0
}

// ==========================================
// Bucketing
// ==========================================

/**
 * Generate a bucket value (0-99) for consistent assignment
 *
 * @param key - Unique key for bucketing (usually flagKey + userId)
 * @param salt - Optional salt for different distributions
 * @returns Number between 0 and 99
 */
export function getBucket(key: string, salt: string = ''): number {
	const hash = murmurHash3(salt + key)
	return hash % 100
}

/**
 * Check if a bucket falls within a percentage range
 *
 * @param bucket - Bucket value (0-99)
 * @param percentage - Target percentage (0-100)
 * @returns Whether the bucket is within the percentage
 */
export function isInPercentage(bucket: number, percentage: number): boolean {
	return bucket < percentage
}

/**
 * Get consistent user bucket for a flag
 *
 * Combines userId/anonymousId with flag key and salt for consistent bucketing.
 */
export function getUserBucket(
	flagKey: string,
	userId: string | undefined,
	anonymousId: string | undefined,
	salt: string = ''
): number {
	const identifier = userId || anonymousId || 'anonymous'
	return getBucket(`${flagKey}:${identifier}`, salt)
}

// ==========================================
// Variant Selection
// ==========================================

interface VariantWeight {
	key: string
	weight: number
}

/**
 * Select a variant based on weighted distribution
 *
 * @param variants - Array of variants with weights
 * @param bucket - Bucket value (0-99)
 * @returns Selected variant key
 */
export function selectVariant(variants: VariantWeight[], bucket: number): string {
	if (variants.length === 0) {
		throw new Error('No variants provided')
	}

	if (variants.length === 1) {
		return variants[0]!.key
	}

	// Normalize weights to sum to 100
	const totalWeight = variants.reduce((sum, v) => sum + (v.weight ?? 0), 0)
	let normalizedBucket = bucket

	if (totalWeight !== 100 && totalWeight > 0) {
		// Scale bucket to match total weight
		normalizedBucket = (bucket / 100) * totalWeight
	}

	// Find which variant the bucket falls into
	let cumulative = 0
	for (const variant of variants) {
		cumulative += variant.weight ?? 0
		if (normalizedBucket < cumulative) {
			return variant.key
		}
	}

	// Fallback to last variant (shouldn't happen with proper weights)
	return variants[variants.length - 1]!.key
}

/**
 * Generate a consistent random number for a user+flag combination
 *
 * Useful for secondary randomization within rules
 */
export function getConsistentRandom(
	flagKey: string,
	userId: string | undefined,
	seed: string = ''
): number {
	const identifier = userId || 'anonymous'
	const hash = murmurHash3(`${seed}:${flagKey}:${identifier}`)
	return (hash >>> 0) / 0xffffffff // Normalize to 0-1
}
