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
