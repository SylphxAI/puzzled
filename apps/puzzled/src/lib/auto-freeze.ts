export type AutoFreezeOutcome = { enabled: boolean; failed: boolean }

/**
 * Flip auto-freeze from `current`. On success the state is what the server
 * answered; on any failure it stays `current` and `failed` is set, so the UI
 * never shows a state the server did not confirm.
 */
export async function requestAutoFreeze(
	current: boolean,
	save: (enabled: boolean) => Promise<boolean>,
): Promise<AutoFreezeOutcome> {
	try {
		return { enabled: await save(!current), failed: false }
	} catch {
		return { enabled: current, failed: true }
	}
}
