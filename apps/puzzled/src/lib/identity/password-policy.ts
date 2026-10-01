/**
 * The shortest password Puzzled accepts. The sign-up route enforces it on the
 * server; the sign-up and reset forms show and check the same number, so a
 * player is never told a password is fine and then refused.
 */
export const MIN_PASSWORD_LENGTH = 12

export function isPasswordLongEnough(value: string): boolean {
	return value.length >= MIN_PASSWORD_LENGTH
}
