/**
 * Advertising for free players (Google AdSense).
 *
 * Off until an ad account is configured: with no `ADS_ADSENSE_CLIENT_ID` and
 * `ADS_SLOT_ID` the site loads no ad script, allows no ad host in its
 * Content Security Policy and renders no slot. Placement rules live in
 * docs/north-star/MONETIZATION.md: the archive index and the result screen
 * only, never while a puzzle is being played, and never for a Puzzled Plus
 * subscriber.
 */

export type AdsConfig = {
	/** AdSense publisher id, `ca-pub-<digits>`. */
	clientId: string
	/** Ad unit id (digits) used by the archive and result slots. */
	slotId: string
}

type AdsEnv = {
	ADS_ADSENSE_CLIENT_ID?: string
	ADS_SLOT_ID?: string
}

const CLIENT_ID = /^ca-pub-\d{8,20}$/
const SLOT_ID = /^\d{4,20}$/

/** The configuration, or null when either id is missing or malformed. */
export function adsConfig(source: AdsEnv): AdsConfig | null {
	const clientId = source.ADS_ADSENSE_CLIENT_ID?.trim() ?? ''
	const slotId = source.ADS_SLOT_ID?.trim() ?? ''
	if (!CLIENT_ID.test(clientId) || !SLOT_ID.test(slotId)) return null
	return { clientId, slotId }
}

/** Ads run for a viewer only when configured and the viewer has no Plus. */
export function adsFor(config: AdsConfig | null, entitled: boolean): AdsConfig | null {
	return entitled ? null : config
}

/** The AdSense loader script for a publisher id. */
export function adScriptSrc(clientId: string): string {
	return `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${clientId}`
}

/** Hosts the ad network needs, added to the policy only while ads are configured. */
export const AD_CSP_HOSTS = {
	frame: [
		'https://googleads.g.doubleclick.net',
		'https://tpc.googlesyndication.com',
		'https://www.google.com',
	],
	connect: [
		'https://pagead2.googlesyndication.com',
		'https://googleads.g.doubleclick.net',
		'https://ep1.adtrafficquality.google',
	],
} as const
