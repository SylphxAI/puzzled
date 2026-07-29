/**
 * Pure redirect URL resolution for SylphxProvider auth actions.
 * Platform requires absolute URLs for redirect_uri validation.
 */

/** Resolve relative/absolute redirect targets against a base origin. */
export function resolveRedirectUrlPure(
	url: string | undefined,
	opts: { origin: string; href: string },
): string {
	if (!url) return opts.href
	// Relative URL starting with / - resolve against current origin
	if (url.startsWith('/') && !url.startsWith('//')) {
		return `${opts.origin}${url}`
	}
	return url
}
