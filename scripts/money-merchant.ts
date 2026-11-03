/** Money's proto JSON omits false booleans. Test Connect credentials need not
 * report live account charge capability; production still must report it. */
export function merchantModeMatches(merchant: Record<string, unknown>, live: boolean): boolean {
	return (merchant.livemode ?? false) === live
}

export function merchantAvailable(merchant: Record<string, unknown>, live: boolean): boolean {
	return (
		merchant.state === 'connected' &&
		(!live && merchant.credential === 'connect' ? true : merchant.charges_enabled === true)
	)
}

if (import.meta.main) {
	const [path, mode] = process.argv.slice(2)
	if (!path || (mode !== 'test' && mode !== 'live')) process.exit(1)
	const merchant = await Bun.file(path).json()
	const live = mode === 'live'
	if (
		!merchant ||
		typeof merchant !== 'object' ||
		merchant.processor !== 'stripe' ||
		!/^acct_[A-Za-z0-9]+$/.test(merchant.account_id) ||
		!merchantModeMatches(merchant, live) ||
		!merchantAvailable(merchant, live)
	) {
		console.error(`::error::merchant is not an available Stripe ${mode} account`)
		process.exit(1)
	}
}
