import { Code, ConnectError } from '@connectrpc/connect'

/** True when SubmitGuess failed because the guest/user already finished today. */
export function isAlreadyPlayedError(error: unknown): boolean {
	if (error instanceof ConnectError) {
		if (error.code === Code.AlreadyExists) return true
		if (error.rawMessage.toLowerCase().includes('already_played')) return true
	}
	const message = error instanceof Error ? error.message : String(error)
	return /already_played|already exists/i.test(message)
}
