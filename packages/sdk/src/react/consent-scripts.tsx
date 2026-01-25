/**
 * Consent-Aware Script Loading
 *
 * GDPR/CCPA-compliant script blocking that prevents third-party scripts
 * from loading until user consent is granted.
 *
 * ## Features
 *
 * - **Script Blocking**: Scripts only load after consent is granted
 * - **Script Queue**: Blocked scripts are queued and executed when consent changes
 * - **Known Scripts**: Pre-configured patterns for common analytics/marketing scripts
 * - **SSR Safe**: Works with Next.js SSR and client-side rendering
 * - **Dynamic Consent**: Automatically loads scripts when consent is granted later
 *
 * ## Usage
 *
 * @example
 * ```tsx
 * // Block a specific script
 * <ConsentScript
 *   src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXX"
 *   category="analytics"
 *   strategy="afterInteractive"
 * />
 *
 * // Using known script presets
 * <GoogleAnalytics measurementId="G-XXXXXX" />
 * <GoogleTagManager containerId="GTM-XXXXXX" />
 * <FacebookPixel pixelId="XXXXXX" />
 *
 * // Inline script with consent
 * <ConsentScript category="marketing">
 *   {`console.log('Marketing script loaded')`}
 * </ConsentScript>
 * ```
 */

'use client'

import { useEffect, useRef, useCallback, createContext, useContext, useState, type ReactNode } from 'react'
import { useConsent, useConsentGate, type ConsentCategory } from './consent-hooks'

// ============================================
// Types
// ============================================

export type ScriptStrategy = 'beforeInteractive' | 'afterInteractive' | 'lazyOnload' | 'worker'

export interface ConsentScriptProps {
	/** External script URL */
	src?: string
	/** Inline script content (children) */
	children?: string
	/** Required consent category */
	category: ConsentCategory
	/** Script loading strategy (Next.js compatible) */
	strategy?: ScriptStrategy
	/** Called when script loads successfully */
	onLoad?: () => void
	/** Called when script fails to load */
	onError?: (error: Error) => void
	/** Called when script is blocked due to no consent */
	onBlock?: () => void
	/** Additional script attributes */
	async?: boolean
	defer?: boolean
	id?: string
	nonce?: string
	/** data-* attributes */
	[key: `data-${string}`]: string | undefined
}

export interface ScriptQueueItem {
	id: string
	src?: string
	content?: string
	category: ConsentCategory
	strategy: ScriptStrategy
	attributes: Record<string, string | boolean | undefined>
	onLoad?: () => void
	onError?: (error: Error) => void
}

export interface ScriptManagerContextValue {
	/** Queue a script for loading when consent is granted */
	queueScript: (item: ScriptQueueItem) => void
	/** Remove a script from queue */
	dequeueScript: (id: string) => void
	/** Check if a script is loaded */
	isLoaded: (id: string) => boolean
	/** Get all blocked scripts */
	getBlockedScripts: () => ScriptQueueItem[]
}

// ============================================
// Script Manager Context
// ============================================

const ScriptManagerContext = createContext<ScriptManagerContextValue | null>(null)

/**
 * Script Manager Provider
 *
 * Manages the queue of blocked scripts and loads them when consent changes.
 * Should be placed inside SylphxProvider.
 *
 * @example
 * ```tsx
 * <SylphxProvider config={config}>
 *   <ScriptManagerProvider>
 *     <App />
 *   </ScriptManagerProvider>
 * </SylphxProvider>
 * ```
 */
export function ScriptManagerProvider({ children }: { children: ReactNode }) {
	const [queue, setQueue] = useState<ScriptQueueItem[]>([])
	const [loadedScripts, setLoadedScripts] = useState<Set<string>>(new Set())

	const queueScript = useCallback((item: ScriptQueueItem) => {
		setQueue((prev) => {
			// Don't add duplicates
			if (prev.some((s) => s.id === item.id)) return prev
			return [...prev, item]
		})
	}, [])

	const dequeueScript = useCallback((id: string) => {
		setQueue((prev) => prev.filter((s) => s.id !== id))
	}, [])

	const isLoaded = useCallback((id: string) => loadedScripts.has(id), [loadedScripts])

	const getBlockedScripts = useCallback(() => queue, [queue])

	// Mark script as loaded
	const markLoaded = useCallback((id: string) => {
		setLoadedScripts((prev) => new Set(prev).add(id))
	}, [])

	const value: ScriptManagerContextValue = {
		queueScript,
		dequeueScript,
		isLoaded,
		getBlockedScripts,
	}

	return (
		<ScriptManagerContext.Provider value={value}>
			{children}
			{/* Render queue processors for each category */}
			<QueueProcessor category="analytics" queue={queue} onLoad={markLoaded} onDequeue={dequeueScript} />
			<QueueProcessor category="marketing" queue={queue} onLoad={markLoaded} onDequeue={dequeueScript} />
			<QueueProcessor category="preferences" queue={queue} onLoad={markLoaded} onDequeue={dequeueScript} />
		</ScriptManagerContext.Provider>
	)
}

/**
 * Hook to access script manager
 */
export function useScriptManager(): ScriptManagerContextValue | null {
	return useContext(ScriptManagerContext)
}

// ============================================
// Queue Processor
// ============================================

interface QueueProcessorProps {
	category: ConsentCategory
	queue: ScriptQueueItem[]
	onLoad: (id: string) => void
	onDequeue: (id: string) => void
}

function QueueProcessor({ category, queue, onLoad, onDequeue }: QueueProcessorProps) {
	const { hasConsent, isLoading } = useConsentGate({ category })
	const processedRef = useRef<Set<string>>(new Set())

	useEffect(() => {
		if (isLoading || !hasConsent) return

		// Process all queued scripts for this category
		const categoryScripts = queue.filter((s) => s.category === category && !processedRef.current.has(s.id))

		for (const script of categoryScripts) {
			processedRef.current.add(script.id)
			loadScript(script)
				.then(() => {
					script.onLoad?.()
					onLoad(script.id)
				})
				.catch((error) => {
					script.onError?.(error)
				})
				.finally(() => {
					onDequeue(script.id)
				})
		}
	}, [hasConsent, isLoading, queue, category, onLoad, onDequeue])

	return null
}

// ============================================
// Script Loading Utility
// ============================================

/**
 * Load a script dynamically
 */
async function loadScript(item: ScriptQueueItem): Promise<void> {
	return new Promise((resolve, reject) => {
		// Check if already loaded
		if (item.src && document.querySelector(`script[src="${item.src}"]`)) {
			resolve()
			return
		}

		const script = document.createElement('script')

		if (item.src) {
			script.src = item.src
		} else if (item.content) {
			script.textContent = item.content
		}

		// Apply attributes
		for (const [key, value] of Object.entries(item.attributes)) {
			if (value === undefined) continue
			if (typeof value === 'boolean') {
				if (value) script.setAttribute(key, '')
			} else {
				script.setAttribute(key, value)
			}
		}

		// Set id for tracking
		if (item.id) {
			script.id = item.id
		}

		// Apply strategy
		switch (item.strategy) {
			case 'beforeInteractive':
				// Load immediately (blocking)
				break
			case 'afterInteractive':
				script.async = true
				break
			case 'lazyOnload':
				script.async = true
				script.defer = true
				break
			case 'worker':
				// Web Worker strategy - not supported for external scripts
				// Falls back to async
				script.async = true
				break
		}

		script.onload = () => resolve()
		script.onerror = () => reject(new Error(`Failed to load script: ${item.src ?? 'inline'}`))

		// Inline scripts execute immediately
		if (!item.src && item.content) {
			document.head.appendChild(script)
			resolve()
			return
		}

		document.head.appendChild(script)
	})
}

// ============================================
// ConsentScript Component
// ============================================

let scriptIdCounter = 0
function generateScriptId(src?: string): string {
	if (src) {
		// Generate ID from URL
		try {
			const url = new URL(src)
			return `consent-script-${url.hostname.replace(/\./g, '-')}-${scriptIdCounter++}`
		} catch {
			return `consent-script-${scriptIdCounter++}`
		}
	}
	return `consent-script-inline-${scriptIdCounter++}`
}

/**
 * Consent-aware script component
 *
 * Only loads scripts when the required consent category is granted.
 * If consent is not granted, the script is queued for later loading.
 *
 * @example
 * ```tsx
 * // External script
 * <ConsentScript
 *   src="https://example.com/analytics.js"
 *   category="analytics"
 *   onLoad={() => console.log('Loaded!')}
 * />
 *
 * // Inline script
 * <ConsentScript category="marketing">
 *   {`window.fbq('init', 'PIXEL_ID')`}
 * </ConsentScript>
 * ```
 */
export function ConsentScript({
	src,
	children,
	category,
	strategy = 'afterInteractive',
	onLoad,
	onError,
	onBlock,
	async: asyncAttr,
	defer,
	id: providedId,
	nonce,
	...dataAttributes
}: ConsentScriptProps) {
	const scriptManager = useScriptManager()
	const { hasConsent, isLoading } = useConsentGate({
		category,
		onDeny: onBlock,
	})
	const scriptIdRef = useRef(providedId ?? generateScriptId(src))
	const loadedRef = useRef(false)

	// Build attributes object
	const attributes: Record<string, string | boolean | undefined> = {
		async: asyncAttr,
		defer,
		nonce,
		...dataAttributes,
	}

	useEffect(() => {
		// Skip if already loaded
		if (loadedRef.current) return

		// Skip during loading
		if (isLoading) return

		if (hasConsent) {
			// Load immediately
			const item: ScriptQueueItem = {
				id: scriptIdRef.current,
				src,
				content: children,
				category,
				strategy,
				attributes,
				onLoad,
				onError,
			}

			loadScript(item)
				.then(() => {
					loadedRef.current = true
					onLoad?.()
				})
				.catch((error) => {
					onError?.(error)
				})
		} else if (scriptManager) {
			// Queue for later
			scriptManager.queueScript({
				id: scriptIdRef.current,
				src,
				content: children,
				category,
				strategy,
				attributes,
				onLoad,
				onError,
			})
		}
	}, [hasConsent, isLoading, src, children, category, strategy, scriptManager, onLoad, onError, attributes])

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (scriptManager) {
				scriptManager.dequeueScript(scriptIdRef.current)
			}
		}
	}, [scriptManager])

	// Don't render anything - script is loaded dynamically
	return null
}

// ============================================
// Known Script Components
// ============================================

export interface GoogleAnalyticsProps {
	/** Google Analytics Measurement ID (G-XXXXXX) */
	measurementId: string
	/** Script loading strategy */
	strategy?: ScriptStrategy
	/** Additional gtag config options */
	config?: Record<string, unknown>
	/** Called when GA loads */
	onLoad?: () => void
}

/**
 * Google Analytics 4 with consent management
 *
 * Automatically blocks GA until analytics consent is granted.
 * Supports Google Consent Mode v2.
 *
 * @example
 * ```tsx
 * <GoogleAnalytics
 *   measurementId="G-XXXXXX"
 *   config={{ debug_mode: true }}
 * />
 * ```
 */
export function GoogleAnalytics({ measurementId, strategy = 'afterInteractive', config, onLoad }: GoogleAnalyticsProps) {
	const { hasConsent, isLoading } = useConsentGate({ category: 'analytics' })
	const loadedRef = useRef(false)

	useEffect(() => {
		if (loadedRef.current || isLoading || !hasConsent) return

		// Load gtag.js
		const script = document.createElement('script')
		script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`
		script.async = true

		script.onload = () => {
			// Initialize gtag
			window.dataLayer = window.dataLayer || []
			function gtag(...args: unknown[]) {
				window.dataLayer.push(args)
			}
			window.gtag = gtag
			gtag('js', new Date())
			gtag('config', measurementId, config ?? {})

			loadedRef.current = true
			onLoad?.()
		}

		document.head.appendChild(script)
	}, [hasConsent, isLoading, measurementId, config, onLoad])

	return null
}

export interface GoogleTagManagerProps {
	/** GTM Container ID (GTM-XXXXXX) */
	containerId: string
	/** Script loading strategy */
	strategy?: ScriptStrategy
	/** Data layer name (default: dataLayer) */
	dataLayerName?: string
	/** Called when GTM loads */
	onLoad?: () => void
}

/**
 * Google Tag Manager with consent management
 *
 * Blocks GTM until analytics consent is granted.
 * GTM typically requires analytics consent as it can load many sub-scripts.
 *
 * @example
 * ```tsx
 * <GoogleTagManager containerId="GTM-XXXXXX" />
 * ```
 */
export function GoogleTagManager({
	containerId,
	strategy = 'afterInteractive',
	dataLayerName = 'dataLayer',
	onLoad,
}: GoogleTagManagerProps) {
	const { hasConsent, isLoading } = useConsentGate({ category: 'analytics' })
	const loadedRef = useRef(false)

	useEffect(() => {
		if (loadedRef.current || isLoading || !hasConsent) return

		// Initialize dataLayer
		window[dataLayerName as 'dataLayer'] = window[dataLayerName as 'dataLayer'] || []
		window[dataLayerName as 'dataLayer'].push({
			'gtm.start': new Date().getTime(),
			event: 'gtm.js',
		})

		// Load GTM script
		const script = document.createElement('script')
		script.src = `https://www.googletagmanager.com/gtm.js?id=${containerId}${dataLayerName !== 'dataLayer' ? `&l=${dataLayerName}` : ''}`
		script.async = true

		script.onload = () => {
			loadedRef.current = true
			onLoad?.()
		}

		document.head.appendChild(script)
	}, [hasConsent, isLoading, containerId, dataLayerName, onLoad])

	return null
}

export interface FacebookPixelProps {
	/** Facebook Pixel ID */
	pixelId: string
	/** Called when Pixel loads */
	onLoad?: () => void
	/** Auto-track PageView on load */
	autoPageView?: boolean
}

/**
 * Facebook Pixel with consent management
 *
 * Blocks Facebook Pixel until marketing consent is granted.
 *
 * @example
 * ```tsx
 * <FacebookPixel pixelId="XXXXXX" autoPageView />
 * ```
 */
export function FacebookPixel({ pixelId, onLoad, autoPageView = true }: FacebookPixelProps) {
	const { hasConsent, isLoading } = useConsentGate({ category: 'marketing' })
	const loadedRef = useRef(false)

	useEffect(() => {
		if (loadedRef.current || isLoading || !hasConsent) return

		// Initialize fbq
		const n = (window.fbq = function (...args: unknown[]) {
			if (n.callMethod) {
				n.callMethod.apply(n, args)
			} else {
				n.queue.push(args)
			}
		} as unknown as typeof window.fbq)
		if (!window._fbq) window._fbq = n
		n.push = n
		n.loaded = true
		n.version = '2.0'
		n.queue = []

		// Load Facebook Pixel script
		const script = document.createElement('script')
		script.src = 'https://connect.facebook.net/en_US/fbevents.js'
		script.async = true

		script.onload = () => {
			window.fbq('init', pixelId)
			if (autoPageView) {
				window.fbq('track', 'PageView')
			}
			loadedRef.current = true
			onLoad?.()
		}

		document.head.appendChild(script)
	}, [hasConsent, isLoading, pixelId, autoPageView, onLoad])

	return null
}

export interface HotjarProps {
	/** Hotjar Site ID */
	siteId: number
	/** Hotjar Snippet Version (default: 6) */
	version?: number
	/** Called when Hotjar loads */
	onLoad?: () => void
}

/**
 * Hotjar with consent management
 *
 * Blocks Hotjar until analytics consent is granted.
 *
 * @example
 * ```tsx
 * <Hotjar siteId={123456} />
 * ```
 */
export function Hotjar({ siteId, version = 6, onLoad }: HotjarProps) {
	const { hasConsent, isLoading } = useConsentGate({ category: 'analytics' })
	const loadedRef = useRef(false)

	useEffect(() => {
		if (loadedRef.current || isLoading || !hasConsent) return

		// Initialize Hotjar
		window.hj =
			window.hj ||
			function (...args: unknown[]) {
				;(window.hj.q = window.hj.q || []).push(args)
			}
		window._hjSettings = { hjid: siteId, hjsv: version }

		// Load Hotjar script
		const script = document.createElement('script')
		script.src = `https://static.hotjar.com/c/hotjar-${siteId}.js?sv=${version}`
		script.async = true

		script.onload = () => {
			loadedRef.current = true
			onLoad?.()
		}

		document.head.appendChild(script)
	}, [hasConsent, isLoading, siteId, version, onLoad])

	return null
}

export interface IntercomProps {
	/** Intercom App ID */
	appId: string
	/** Called when Intercom loads */
	onLoad?: () => void
}

/**
 * Intercom with consent management
 *
 * Blocks Intercom until preferences consent is granted.
 * (Intercom stores user preferences and communication history)
 *
 * @example
 * ```tsx
 * <Intercom appId="abc123" />
 * ```
 */
export function Intercom({ appId, onLoad }: IntercomProps) {
	const { hasConsent, isLoading } = useConsentGate({ category: 'preferences' })
	const loadedRef = useRef(false)

	useEffect(() => {
		if (loadedRef.current || isLoading || !hasConsent) return

		// Initialize Intercom
		window.intercomSettings = { app_id: appId }

		const ic = window.Intercom
		if (typeof ic === 'function') {
			ic('reattach_activator')
			ic('update', window.intercomSettings)
		} else {
			const i = function (...args: unknown[]) {
				i.c(args)
			} as unknown as typeof window.Intercom
			i.q = []
			i.c = function (args: unknown[]) {
				i.q.push(args)
			}
			window.Intercom = i
		}

		// Load Intercom script
		const script = document.createElement('script')
		script.src = `https://widget.intercom.io/widget/${appId}`
		script.async = true

		script.onload = () => {
			loadedRef.current = true
			onLoad?.()
		}

		document.head.appendChild(script)
	}, [hasConsent, isLoading, appId, onLoad])

	return null
}

// ============================================
// Google Consent Mode v2
// ============================================

/**
 * Consent Mode v2 consent states
 *
 * These map to Google's consent types:
 * - ad_storage: Enables storage related to advertising
 * - ad_user_data: Sets consent for sending user data to Google for ads
 * - ad_personalization: Sets consent for personalized advertising
 * - analytics_storage: Enables storage related to analytics
 * - functionality_storage: Enables storage for website functionality
 * - personalization_storage: Enables storage for personalization
 * - security_storage: Enables storage for security (always granted)
 */
export type GoogleConsentType =
	| 'ad_storage'
	| 'ad_user_data'
	| 'ad_personalization'
	| 'analytics_storage'
	| 'functionality_storage'
	| 'personalization_storage'
	| 'security_storage'

export type GoogleConsentState = 'granted' | 'denied'

export interface GoogleConsentModeConfig {
	/** Default consent states (before user interaction) */
	defaults?: Partial<Record<GoogleConsentType, GoogleConsentState>>
	/** Wait for update timeout in ms (default: 500) */
	waitForUpdate?: number
	/** Regions to apply defaults (e.g., ['EU', 'US-CA']) */
	regions?: string[]
	/** Enable URL passthrough for ad click info */
	urlPassthrough?: boolean
	/** Enable ads data redaction when consent denied */
	adsDataRedaction?: boolean
}

export interface GoogleConsentModeProps extends GoogleConsentModeConfig {
	/** Called when consent mode is initialized */
	onInit?: () => void
}

/**
 * Map our consent categories to Google Consent Mode types
 */
const CONSENT_CATEGORY_TO_GOOGLE: Record<ConsentCategory, GoogleConsentType[]> = {
	necessary: ['security_storage'],
	functional: ['functionality_storage'],
	preferences: ['personalization_storage'],
	analytics: ['analytics_storage'],
	marketing: ['ad_storage', 'ad_user_data', 'ad_personalization'],
}

/**
 * Google Consent Mode v2 Integration
 *
 * Automatically syncs consent state with Google's Consent Mode API.
 * Place this component early in your app (before Google tags).
 *
 * @see https://developers.google.com/tag-platform/security/guides/consent
 *
 * @example
 * ```tsx
 * // Basic usage with defaults
 * <GoogleConsentMode
 *   defaults={{
 *     ad_storage: 'denied',
 *     analytics_storage: 'denied',
 *   }}
 * />
 *
 * // With region-specific defaults (EU only)
 * <GoogleConsentMode
 *   defaults={{
 *     ad_storage: 'denied',
 *     ad_user_data: 'denied',
 *     ad_personalization: 'denied',
 *     analytics_storage: 'denied',
 *   }}
 *   regions={['EU']}
 *   waitForUpdate={500}
 *   urlPassthrough={true}
 *   adsDataRedaction={true}
 * />
 * ```
 */
export function GoogleConsentMode({
	defaults = {
		ad_storage: 'denied',
		ad_user_data: 'denied',
		ad_personalization: 'denied',
		analytics_storage: 'denied',
		functionality_storage: 'granted',
		personalization_storage: 'denied',
		security_storage: 'granted',
	},
	waitForUpdate = 500,
	regions,
	urlPassthrough = true,
	adsDataRedaction = true,
	onInit,
}: GoogleConsentModeProps) {
	const { hasConsent: checkConsent, isLoading } = useConsent()
	const initializedRef = useRef(false)
	const lastConsentRef = useRef<Record<string, boolean>>({})

	// Initialize consent mode defaults
	useEffect(() => {
		if (initializedRef.current) return

		// Initialize dataLayer and gtag
		window.dataLayer = window.dataLayer || []
		function gtag(...args: unknown[]) {
			window.dataLayer.push(args)
		}
		window.gtag = gtag

		// Set default consent state
		const defaultConsent: Record<string, string> = {}
		for (const [type, state] of Object.entries(defaults)) {
			defaultConsent[type] = state
		}

		// Add regions if specified
		if (regions?.length) {
			gtag('consent', 'default', {
				...defaultConsent,
				regions,
				wait_for_update: waitForUpdate,
			})
		} else {
			gtag('consent', 'default', {
				...defaultConsent,
				wait_for_update: waitForUpdate,
			})
		}

		// Configure additional settings
		if (urlPassthrough) {
			gtag('set', 'url_passthrough', true)
		}

		if (adsDataRedaction) {
			gtag('set', 'ads_data_redaction', true)
		}

		initializedRef.current = true
		onInit?.()
	}, [defaults, waitForUpdate, regions, urlPassthrough, adsDataRedaction, onInit])

	// Update consent when user preferences change
	useEffect(() => {
		if (!initializedRef.current || isLoading) return

		// Build Google consent update from our categories
		const consentUpdate: Record<string, GoogleConsentState> = {}

		// Check each category and map to Google consent types
		for (const category of ['necessary', 'functional', 'preferences', 'analytics', 'marketing'] as ConsentCategory[]) {
			const hasCategory = checkConsent(category)
			const googleTypes = CONSENT_CATEGORY_TO_GOOGLE[category]

			for (const googleType of googleTypes) {
				consentUpdate[googleType] = hasCategory ? 'granted' : 'denied'
			}
		}

		// Only update if something changed
		const consentKey = JSON.stringify(consentUpdate)
		if (consentKey === JSON.stringify(lastConsentRef.current)) return

		lastConsentRef.current = consentUpdate as unknown as Record<string, boolean>

		// Send consent update to Google
		window.gtag?.('consent', 'update', consentUpdate)
	}, [checkConsent, isLoading])

	return null
}

/**
 * Hook to manually update Google Consent Mode
 *
 * @example
 * ```tsx
 * const { updateConsent, revokeAll, grantAll } = useGoogleConsentMode()
 *
 * // Update specific consent type
 * updateConsent('analytics_storage', 'granted')
 *
 * // Revoke all marketing consent
 * updateConsent('ad_storage', 'denied')
 * updateConsent('ad_user_data', 'denied')
 * updateConsent('ad_personalization', 'denied')
 * ```
 */
export function useGoogleConsentMode() {
	const updateConsent = useCallback((type: GoogleConsentType, state: GoogleConsentState) => {
		if (typeof window === 'undefined' || !window.gtag) return

		window.gtag('consent', 'update', {
			[type]: state,
		})
	}, [])

	const updateMultiple = useCallback((consents: Partial<Record<GoogleConsentType, GoogleConsentState>>) => {
		if (typeof window === 'undefined' || !window.gtag) return

		window.gtag('consent', 'update', consents)
	}, [])

	const revokeAll = useCallback(() => {
		updateMultiple({
			ad_storage: 'denied',
			ad_user_data: 'denied',
			ad_personalization: 'denied',
			analytics_storage: 'denied',
			personalization_storage: 'denied',
		})
	}, [updateMultiple])

	const grantAll = useCallback(() => {
		updateMultiple({
			ad_storage: 'granted',
			ad_user_data: 'granted',
			ad_personalization: 'granted',
			analytics_storage: 'granted',
			functionality_storage: 'granted',
			personalization_storage: 'granted',
		})
	}, [updateMultiple])

	return {
		updateConsent,
		updateMultiple,
		revokeAll,
		grantAll,
	}
}

// ============================================
// Type Declarations for Global Objects
// ============================================

declare global {
	interface Window {
		// Google Analytics / Consent Mode
		dataLayer: unknown[]
		gtag: (...args: unknown[]) => void

		// Facebook Pixel
		fbq: {
			(...args: unknown[]): void
			callMethod?: (...args: unknown[]) => void
			queue: unknown[][]
			push: (...args: unknown[]) => void
			loaded: boolean
			version: string
		}
		_fbq: typeof window.fbq

		// Hotjar
		hj: {
			(...args: unknown[]): void
			q?: unknown[][]
		}
		_hjSettings: { hjid: number; hjsv: number }

		// Intercom
		Intercom: {
			(...args: unknown[]): void
			q: unknown[][]
			c: (args: unknown[]) => void
		}
		intercomSettings: { app_id: string; [key: string]: unknown }
	}
}
