import {
	type Boundary,
	type BrowserReport,
	type ClickSelector,
	type Crumb,
	contains,
	cspSelectors,
	type Issue,
	MAX_BODY_BYTES,
	MAX_BREADCRUMBS,
	type MediaSelector,
	mediaSelectors,
	messages,
	RELAY_PATH,
	RELAY_TIMEOUT_MS,
	routeTemplate,
} from './browser-report'

const WINDOW_MS = 60_000
const CLICK_WINDOW_MS = 1200
const SETTLE_MS = 350
const MEDIA = 'img,audio,video,source'
const CONTROLS = 'button,a[href],[role="button"],[role="link"],summary'
const currentRoute = () => routeTemplate(location.pathname)

let collector: ReturnType<typeof install> | undefined

export function installBrowserErrorCapture(): void {
	if (typeof window === 'undefined' || collector) return
	try {
		collector = install()
	} catch {
		// Optional instrumentation must not break startup.
	}
}

export function reportBoundaryError(boundary: Boundary): void {
	collector?.report({ type: 'BoundaryError', selector: boundary })
}

export function noteRouterTransition(): void {
	collector?.effect()
}

function mediaTarget(target: unknown): { element: Element; selector: MediaSelector } | undefined {
	if (!(target instanceof Element)) return
	const element = target.localName === 'source' ? target.parentElement : target
	if (element && contains(mediaSelectors, element.localName)) {
		return { element, selector: element.localName }
	}
}

function clickSelector(control: Element): ClickSelector {
	if (control.localName === 'button') return 'button'
	if (control.localName === 'a') return 'link'
	if (control.localName === 'summary') return 'summary'
	return control.getAttribute('role') === 'link' ? 'role=link' : 'role=button'
}

function install() {
	const crumbs: Crumb[] = []
	const sent = new Map<string, number>()
	const reportedClicks = new Set<ClickSelector>()
	const fetchFromPage = window.fetch.bind(window)

	function add(crumb: Crumb) {
		if (crumbs.length === MAX_BREADCRUMBS) crumbs.shift()
		crumbs.push(crumb)
	}

	function report(issue: Issue): boolean {
		try {
			const now = performance.now()
			for (const [key, at] of sent) if (now - at >= WINDOW_MS) sent.delete(key)
			const route = currentRoute()
			const key = JSON.stringify([issue.type, messages[issue.type], route, issue.selector])
			if (sent.size >= 5 || sent.has(key)) return false
			const payload: BrowserReport = { ...issue, route, breadcrumbs: crumbs }
			const body = new TextEncoder().encode(JSON.stringify(payload))
			if (body.byteLength > MAX_BODY_BYTES) return false
			sent.set(key, now)
			const controller = new AbortController()
			const timer = window.setTimeout(() => controller.abort(), RELAY_TIMEOUT_MS)
			void fetchFromPage(RELAY_PATH, {
				method: 'POST',
				mode: 'same-origin',
				credentials: 'omit',
				redirect: 'error',
				referrerPolicy: 'no-referrer',
				headers: { 'content-type': 'application/json' },
				keepalive: true,
				signal: controller.signal,
				body,
			}).then(
				() => window.clearTimeout(timer),
				() => window.clearTimeout(timer),
			)
			return true
		} catch {
			return false
		}
	}

	// Error events on media do not bubble. Never inspect error text or media URLs.
	function inspectMedia(element: Element, startup = false) {
		const target = mediaTarget(element)
		if (!target) return
		if (element.getAttribute('src') === '') {
			report({ type: 'EmptyMediaSource', selector: target.selector })
		} else if (
			startup &&
			((element instanceof HTMLImageElement &&
				element.complete &&
				!!element.currentSrc &&
				!element.naturalWidth) ||
				(element instanceof HTMLMediaElement && !!element.error))
		) {
			report({ type: 'MediaError', selector: target.selector })
		}
	}

	window.addEventListener(
		'error',
		(event) => {
			const target = mediaTarget(event.target)
			if (target) {
				const empty = event.target instanceof Element && event.target.getAttribute('src') === ''
				report({ type: empty ? 'EmptyMediaSource' : 'MediaError', selector: target.selector })
			} else if (event instanceof ErrorEvent) {
				report({ type: 'UncaughtError', selector: 'window' })
			}
		},
		true,
	)
	window.addEventListener('unhandledrejection', () =>
		report({ type: 'UnhandledRejection', selector: 'window' }),
	)
	document.addEventListener('securitypolicyviolation', (event) => {
		const directive = event.effectiveDirective
		report({
			type: 'CSPViolation',
			selector: contains(cspSelectors, directive) ? directive : 'other',
		})
	})
	const scan = (root: ParentNode, startup = false) => {
		for (const element of root.querySelectorAll(MEDIA)) inspectMedia(element, startup)
	}
	new MutationObserver((records) => {
		for (const record of records) {
			if (record.type === 'attributes' && record.target instanceof Element)
				inspectMedia(record.target)
			for (const node of record.addedNodes) {
				if (node instanceof Element) {
					inspectMedia(node)
					scan(node)
				}
			}
		}
	}).observe(document, {
		subtree: true,
		childList: true,
		attributes: true,
		attributeFilter: ['src'],
	})
	// Defer parsing the existing document; listeners above are already active.
	window.setTimeout(() => scan(document, true), 0)

	// Only keep a click candidate while looking for effects. Any observed
	// navigation, DOM mutation, native input, or network activity resets it.
	let burst: { control: Element; started: number; count: number; timer: number } | undefined
	const clickObserver = new MutationObserver(() => effect())
	function effect() {
		if (!burst) return
		window.clearTimeout(burst.timer)
		clickObserver.disconnect()
		burst = undefined
	}

	function navigate() {
		effect()
		add({ kind: 'navigation', route: currentRoute() })
	}
	navigate()
	window.addEventListener('popstate', navigate)
	window.addEventListener('hashchange', navigate)
	window.addEventListener('pagehide', effect)
	for (const method of ['pushState', 'replaceState'] as const) {
		const original = history[method]
		history[method] = function (...args) {
			const before = location.href
			original.apply(this, args)
			if (before !== location.href) navigate()
		}
	}

	function status(code: number) {
		effect()
		if (code >= 100 && code <= 599) add({ kind: 'http', route: currentRoute(), status: code })
	}
	// Keep this relay itself out of both the network effect detector and crumbs.
	const browser: { fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> } =
		window
	browser.fetch = (...args) => {
		effect()
		return fetchFromPage(...args).then((response) => {
			status(response.status)
			return response
		})
	}
	const xhrSend = XMLHttpRequest.prototype.send
	XMLHttpRequest.prototype.send = function (this: XMLHttpRequest, ...args) {
		effect()
		const onEnd = () => status(this.status)
		this.addEventListener('loadend', onEnd, { once: true })
		try {
			xhrSend.apply(this, args)
		} catch (error) {
			this.removeEventListener('loadend', onEnd)
			throw error
		}
	}
	document.addEventListener('input', effect, true)
	document.addEventListener('submit', effect, true)
	document.addEventListener('scroll', effect, true)
	document.addEventListener(
		'click',
		(event) => {
			const control = event.target instanceof Element ? event.target.closest(CONTROLS) : null
			if (
				!control ||
				event.button !== 0 ||
				event.ctrlKey ||
				event.metaKey ||
				event.shiftKey ||
				event.altKey
			) {
				effect()
				return
			}
			const selector = clickSelector(control)
			add({ kind: 'click', route: currentRoute(), selector })
			if (control.matches('a[href]')) {
				// The default action can start navigation well before pagehide.
				window.setTimeout(() => {
					if (burst?.control === control && !event.defaultPrevented) effect()
				}, 0)
			}
			if (
				reportedClicks.has(selector) ||
				control.matches('a[download],a[target]:not([target="_self"])')
			) {
				effect()
				return
			}
			const now = performance.now()
			if (burst?.count === 3) {
				if (burst.control === control) return
				effect()
			}
			if (!burst || burst.control !== control || now - burst.started > CLICK_WINDOW_MS) {
				effect()
				burst = {
					control,
					started: now,
					count: 1,
					timer: window.setTimeout(effect, CLICK_WINDOW_MS),
				}
				clickObserver.observe(document, {
					subtree: true,
					childList: true,
					attributes: true,
					characterData: true,
				})
				return
			}
			if (++burst.count === 3) {
				window.clearTimeout(burst.timer)
				burst.timer = window.setTimeout(() => {
					effect()
					if (report({ type: 'IneffectiveClick', selector })) reportedClicks.add(selector)
				}, SETTLE_MS)
			}
		},
		true,
	)

	return { report, effect }
}
