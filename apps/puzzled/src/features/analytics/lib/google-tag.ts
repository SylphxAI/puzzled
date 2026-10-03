/**
 * Google tag (gtag.js) for GA4 and Google Ads, consent first.
 *
 * Basic consent mode: the inline defaults deny every signal, and gtag.js is
 * injected, and `config` sent, only once the visitor has stored a choice that
 * grants something. Unanswered or declined means no Google request at all.
 * Analytics consent covers GA4 (`analytics_storage`); marketing consent covers
 * Ads (`ad_storage`, `ad_user_data`). `ad_personalization` is never granted.
 *
 * The page address, title and referrer sent to Google are fixed to an
 * allowlist of public marketing paths; a game, share or account URL never
 * reaches Google. With no ids configured the whole module is inert.
 */

export type GoogleTagIds = { ga: string | null; ads: string | null }

type IdSource = { GA_MEASUREMENT_ID?: string; GOOGLE_ADS_ID?: string }

const GA_ID = /^G-[A-Z0-9]{4,20}$/
const ADS_ID = /^AW-\d{6,15}$/

/** Validated ids, or null when neither is configured (nothing loads). */
export function googleTagIds(source: IdSource): GoogleTagIds | null {
	const ga = source.GA_MEASUREMENT_ID?.trim() ?? ''
	const ads = source.GOOGLE_ADS_ID?.trim() ?? ''
	const ids = { ga: GA_ID.test(ga) ? ga : null, ads: ADS_ID.test(ads) ? ads : null }
	return ids.ga || ids.ads ? ids : null
}

export type ConsentChoice = { analytics: boolean; marketing: boolean }

export type ConsentSignals = {
	ad_storage: 'granted' | 'denied'
	ad_user_data: 'granted' | 'denied'
	ad_personalization: 'denied'
	analytics_storage: 'granted' | 'denied'
}

const state = (on: boolean) => (on ? 'granted' : 'denied')

/** Consent mode v2 signals for a stored choice. Personalization is always denied. */
export function consentSignals(choice: ConsentChoice): ConsentSignals {
	return {
		ad_storage: state(choice.marketing),
		ad_user_data: state(choice.marketing),
		ad_personalization: 'denied',
		analytics_storage: state(choice.analytics),
	}
}

/**
 * Inline script run before anything else: the data layer, `gtag`, and the
 * denied defaults with a 500 ms wait for an update. There is no geo signal in
 * the product, so the defaults are denied everywhere, not only in EEA/GB/CH.
 */
export const CONSENT_DEFAULT_SCRIPT = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('consent','default',${JSON.stringify(
	{ ...consentSignals({ analytics: false, marketing: false }), wait_for_update: 500 },
)});`

export const SITE_TITLE = 'Puzzled'

const LOCALE_PREFIX = /^\/(en-GB|zh-HK|zh-CN|zh-TW)(?=\/|$)/
const PUBLIC_PATHS = new Set([
	'/',
	'/pricing',
	'/privacy',
	'/terms',
	'/support',
	'/login',
	'/signup',
])

/** The path Google may see for this route, or null for any other route. */
export function trackablePath(pathname: string): string | null {
	const stripped = pathname.replace(LOCALE_PREFIX, '') || '/'
	const path = stripped.length > 1 ? stripped.replace(/\/+$/, '') : stripped
	return PUBLIC_PATHS.has(path) ? path : null
}

const GOOGLE_COOKIE = /^(_ga|_ga_[A-Z0-9]+|_gid|_gat.*|_gcl_[a-z]+|_gac_.+|__gads|__gpi)$/

/** Names of Google cookies in a `document.cookie` string. */
export function googleCookieNames(cookies: string): string[] {
	return cookies
		.split(';')
		.map((pair) => pair.trim().split('=')[0] ?? '')
		.filter((name) => GOOGLE_COOKIE.test(name))
}

/** Expire every Google cookie on this host and its parent domains. */
export function deleteGoogleCookies(doc: { cookie: string }, hostname: string): void {
	const parts = hostname.split('.')
	const domains = ['']
	for (let i = 0; i < parts.length - 1; i += 1)
		domains.push(`; Domain=.${parts.slice(i).join('.')}`)
	for (const name of googleCookieNames(doc.cookie)) {
		for (const domain of domains) {
			// biome-ignore lint/suspicious/noDocumentCookie: removing Google cookies when consent is withdrawn
			doc.cookie = `${name}=; Path=/; Max-Age=0${domain}`
		}
	}
}

type GtagFn = (...args: unknown[]) => void

export type TagWindow = {
	dataLayer?: unknown[]
	gtag?: GtagFn
	location: { origin: string; hostname: string }
	localStorage?: { getItem(key: string): string | null; setItem(key: string, value: string): void }
} & Record<string, unknown>

export type TagDocument = {
	cookie: string
	head: { appendChild(node: unknown): unknown }
	createElement(tag: 'script'): { src: string; async: boolean }
}

export type GoogleTagController = {
	/** Apply the current stored consent: load, configure or withdraw. */
	sync(): void
	/** A page view for a route; only allowlisted public routes are reported. */
	pageView(pathname: string): boolean
	/** A conversion event to the destinations the visitor consented to. */
	event(
		name: string,
		params: Record<string, unknown>,
		options?: { analyticsOnly?: boolean },
	): boolean
	/** Has the visitor granted anything a Google destination could use? */
	hasConsent(): boolean
}

/** Characters allowed in an event parameter string: nothing that can carry an address. */
function safeText(value: string): string {
	return value.replace(/[^A-Za-z0-9_.:-]/g, '').slice(0, 100)
}

const OPAQUE_ID = /^[A-Za-z0-9_-]{6,128}$/

/** Keep only the parameters conversions need; strings are reduced to a safe charset. */
export function cleanEventParams(params: Record<string, unknown>): Record<string, unknown> {
	const out: Record<string, unknown> = {}
	for (const [key, value] of Object.entries(params)) {
		if (key === 'value' && typeof value === 'number' && Number.isFinite(value)) out[key] = value
		else if (key === 'currency' && typeof value === 'string')
			out[key] = safeText(value).toUpperCase().slice(0, 3)
		else if (
			(key === 'method' || key === 'plan' || key === 'transaction_id') &&
			typeof value === 'string'
		)
			out[key] = safeText(value)
		else if ((key === 'vital_name' || key === 'vital_rating') && typeof value === 'string')
			out[key] = safeText(value)
		else if (key === 'vital_route' && typeof value === 'string')
			out[key] = value.replace(/[^A-Za-z0-9/[\]-]/g, '').slice(0, 40)
		else if (key === 'vital_value' && typeof value === 'number' && Number.isFinite(value))
			out[key] = value
		else if (key === 'user_id' && typeof value === 'string' && OPAQUE_ID.test(value))
			out[key] = value
		else if (key === 'items' && Array.isArray(value)) {
			out[key] = value.flatMap((item) => {
				const id = (item as { item_id?: unknown } | null)?.item_id
				return typeof id === 'string' ? [{ item_id: safeText(id) }] : []
			})
		}
	}
	return out
}

export function createGoogleTag(input: {
	ids: GoogleTagIds
	win: TagWindow
	doc: TagDocument
	consent: () => ConsentChoice
}): GoogleTagController {
	const { ids, win, doc } = input
	const base = `${win.location.origin}/`
	let loaded = false
	let gaOn = false
	let adsOn = false
	let lastPath: string | null = null

	function gtag(...args: unknown[]) {
		win.dataLayer = win.dataLayer ?? []
		if (!win.gtag) {
			// gtag.js reads `arguments` objects from the data layer, not arrays.
			win.gtag = function pushArguments() {
				// biome-ignore lint/complexity/noArguments: the data layer needs the arguments object
				win.dataLayer?.push(arguments)
			}
		}
		win.gtag(...args)
	}

	function load(firstId: string) {
		const script = doc.createElement('script')
		script.async = true
		script.src = `https://www.googletagmanager.com/gtag/js?id=${firstId}`
		doc.head.appendChild(script)
		gtag('js', new Date())
		// Fixed before any config so the first hit never carries the real address.
		gtag('set', { page_location: base, page_referrer: '', page_title: SITE_TITLE })
		loaded = true
	}

	function targets(): string[] {
		return [gaOn && ids.ga, adsOn && ids.ads].filter((id): id is string => Boolean(id))
	}

	return {
		sync() {
			const choice = input.consent()
			const wantGa = Boolean(ids.ga) && choice.analytics
			const wantAds = Boolean(ids.ads) && choice.marketing
			if (!wantGa && !wantAds) {
				if (loaded) {
					gtag('consent', 'update', consentSignals({ analytics: false, marketing: false }))
					for (const id of [ids.ga, ids.ads]) if (id) win[`ga-disable-${id}`] = true
					deleteGoogleCookies(doc, win.location.hostname)
				}
				gaOn = false
				adsOn = false
				lastPath = null
				return
			}
			gtag('consent', 'update', consentSignals(choice))
			const first = wantGa ? ids.ga : ids.ads
			if (!loaded && first) load(first)
			if (wantGa && ids.ga && !gaOn) {
				win[`ga-disable-${ids.ga}`] = false
				gtag('config', ids.ga, {
					send_page_view: false,
					allow_google_signals: false,
					allow_ad_personalization_signals: false,
				})
			}
			if (wantAds && ids.ads && !adsOn) {
				win[`ga-disable-${ids.ads}`] = false
				gtag('config', ids.ads, {
					allow_google_signals: false,
					allow_ad_personalization_signals: false,
				})
			}
			if (!wantGa && gaOn && ids.ga) win[`ga-disable-${ids.ga}`] = true
			if (!wantAds && adsOn && ids.ads) win[`ga-disable-${ids.ads}`] = true
			gaOn = wantGa
			adsOn = wantAds
		},
		pageView(pathname) {
			const path = trackablePath(pathname)
			// Back to the base address on every other route.
			const location = path ? `${win.location.origin}${path}` : base
			if (loaded)
				gtag('set', { page_location: location, page_referrer: '', page_title: SITE_TITLE })
			if (!gaOn || !path || path === lastPath) {
				if (!path) lastPath = null
				return false
			}
			lastPath = path
			gtag('event', 'page_view', {
				send_to: ids.ga,
				page_location: location,
				page_title: SITE_TITLE,
			})
			return true
		},
		hasConsent() {
			const choice = input.consent()
			return (Boolean(ids.ga) && choice.analytics) || (Boolean(ids.ads) && choice.marketing)
		},
		event(name, params, options) {
			const sendTo = options?.analyticsOnly ? targets().filter((id) => id === ids.ga) : targets()
			if (!loaded || sendTo.length === 0) return false
			gtag('event', name, { ...cleanEventParams(params), send_to: sendTo })
			return true
		},
	}
}

let active: GoogleTagController | null = null

/** Make a controller the one conversion helpers talk to (null clears it). */
export function setActiveGoogleTag(controller: GoogleTagController | null): void {
	active = controller
}

/** The controller conversion helpers and the vitals reporter talk to. */
export function getActiveGoogleTag(): GoogleTagController | null {
	return active
}

export type CheckoutQuote = { plan: string; value: number; currency: string }

const QUOTE_KEY = 'puzzled:ads:checkout-quote'
const SENT_PREFIX = 'puzzled:ads:sent:'

type Store = {
	getItem(key: string): string | null
	setItem(key: string, value: string): void
	removeItem(key: string): void
}

function store(): Store | null {
	try {
		return typeof window === 'undefined' ? null : window.localStorage
	} catch {
		return null
	}
}

/** The plan and price being checked out, kept until the return page reports it. */
export function rememberCheckoutQuote(quote: CheckoutQuote): void {
	if (!active?.hasConsent()) return
	try {
		store()?.setItem(QUOTE_KEY, JSON.stringify(quote))
	} catch {
		// Private mode: no quote, so no conversion value; checkout is unaffected.
	}
}

function readQuote(storage: Store): CheckoutQuote | null {
	try {
		const raw = JSON.parse(storage.getItem(QUOTE_KEY) ?? 'null') as Partial<CheckoutQuote> | null
		if (
			raw &&
			typeof raw.plan === 'string' &&
			typeof raw.currency === 'string' &&
			typeof raw.value === 'number' &&
			raw.value > 0
		) {
			return { plan: raw.plan, value: raw.value, currency: raw.currency }
		}
	} catch {
		// fall through
	}
	return null
}

function fireOnce(storage: Store, key: string, send: () => boolean): boolean {
	if (storage.getItem(SENT_PREFIX + key)) return false
	if (!send()) return false
	try {
		storage.setItem(SENT_PREFIX + key, '1')
	} catch {
		// Cannot remember; the quote is still cleared by the caller.
	}
	return true
}

/** `sign_up` for a new account. The caller reads its one-shot marker, so a reload cannot repeat it. */
export function trackSignUp(method: string, userId?: string): boolean {
	return active?.event('sign_up', { method, ...(userId ? { user_id: userId } : {}) }) ?? false
}

/**
 * The checkout return: `trial_start` when the subscription is trialing (value
 * is the price that converts after the trial), `purchase` when it is paid. Each
 * fires once per Money checkout session, and the stored quote is cleared after.
 */
export function trackCheckoutReturn(input: {
	sessionId: string
	status: 'trialing' | 'paid'
	userId?: string
}): boolean {
	const storage = store()
	if (!active || !storage || !/^[A-Za-z0-9_]{6,200}$/.test(input.sessionId)) return false
	const quote = readQuote(storage)
	if (!quote) return false
	const tag = active
	const user = input.userId ? { user_id: input.userId } : {}
	const sent = fireOnce(storage, `${input.status}:${input.sessionId}`, () =>
		input.status === 'trialing'
			? tag.event('trial_start', {
					value: quote.value,
					currency: quote.currency,
					plan: quote.plan,
					items: [{ item_id: quote.plan }],
					...user,
				})
			: tag.event('purchase', {
					transaction_id: input.sessionId,
					value: quote.value,
					currency: quote.currency,
					items: [{ item_id: quote.plan }],
					...user,
				}),
	)
	if (sent) storage.removeItem(QUOTE_KEY)
	return sent
}
