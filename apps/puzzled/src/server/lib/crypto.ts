/**
 * Shared Cryptography Utilities
 *
 * Common encryption/decryption functions used across the authentication system.
 * Single source of truth for TOTP secret encryption and backup code handling.
 */

import { symmetricDecrypt } from 'better-auth/crypto'

/**
 * Get the encryption key for TOTP secrets and backup codes
 * Uses the same secret as better-auth for consistency
 *
 * @throws Error if BETTER_AUTH_SECRET is not configured or too short
 */
export function getEncryptionKey(): string {
	const key = process.env.BETTER_AUTH_SECRET
	if (!key || key.length < 32) {
		throw new Error('BETTER_AUTH_SECRET must be at least 32 characters')
	}
	return key
}

/**
 * Decrypt TOTP secret from storage
 *
 * @param encryptedSecret - Encrypted TOTP secret string from database
 * @param key - Encryption key (from getEncryptionKey)
 * @returns Decrypted TOTP secret string
 * @throws Error on decryption failure
 */
export async function decryptTotpSecret(encryptedSecret: string, key: string): Promise<string> {
	return symmetricDecrypt({ key, data: encryptedSecret })
}

/**
 * Decrypt and parse backup codes from storage
 *
 * @param encryptedBackupCodes - Encrypted backup codes string from database
 * @param key - Encryption key (from getEncryptionKey)
 * @returns Array of backup codes, or empty array on failure
 *
 * Note: Returns empty array on failure (graceful degradation) but logs error
 * for investigation. Failure could indicate: corrupted data, key mismatch,
 * or tampering attempt.
 */
export async function decryptBackupCodes(
	encryptedBackupCodes: string,
	key: string,
): Promise<string[]> {
	try {
		const decrypted = await symmetricDecrypt({ key, data: encryptedBackupCodes })
		return JSON.parse(decrypted)
	} catch (err) {
		console.error(
			'[Crypto] Failed to decrypt backup codes:',
			err instanceof Error ? err.message : err,
		)
		return []
	}
}
