const RETRY_DELAY_MS = 1500

async function postOnce(purpose: string, state: 'granted' | 'denied'): Promise<boolean> {
	try {
		const response = await fetch('/api/identity/consent', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			credentials: 'same-origin',
			body: JSON.stringify({ purpose, state }),
		})
		return response.ok
	} catch {
		return false
	}
}

/**
 * Writes one purpose to the server consent ledger. A failed write is retried once after a short
 * delay; if that also fails it is logged (purpose only, no ids). The browser-side choice is already
 * saved, so this never throws and the UI does not wait on a lost ledger write.
 */
export async function recordConsent(
	purpose: string,
	state: 'granted' | 'denied',
	retryDelayMs = RETRY_DELAY_MS,
): Promise<boolean> {
	if (await postOnce(purpose, state)) return true
	await new Promise((resolve) => setTimeout(resolve, retryDelayMs))
	if (await postOnce(purpose, state)) return true
	console.warn('consent record not saved on the server', { purpose, state })
	return false
}
