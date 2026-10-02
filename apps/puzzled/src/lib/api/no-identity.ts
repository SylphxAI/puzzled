import { Code, ConnectError } from '@connectrpc/connect'

/**
 * The api answered that this viewer has no stored identity yet: a guest only
 * gets a player row on their first finished write, so before then every
 * personal read is `unauthenticated`. That is an empty record, not a failure.
 */
export function isNoIdentityError(error: unknown): boolean {
	const code = ConnectError.from(error).code
	return code === Code.Unauthenticated || code === Code.NotFound
}

/** True when a settled personal read was refused only because there is no identity yet. */
export function isNoIdentityRejection(result: PromiseSettledResult<unknown>): boolean {
	return result.status === 'rejected' && isNoIdentityError(result.reason)
}

/**
 * A no-identity answer is an empty record only for a guest. A member session
 * (a user, or a session cookie even when the user lookup failed) that the api
 * does not recognise is an auth fault: the record must read as unavailable,
 * never as erased.
 */
export function isEmptyGuestRecord(
	memberSession: boolean,
	result: PromiseSettledResult<unknown>,
): boolean {
	return !memberSession && isNoIdentityRejection(result)
}
