/**
 * Analytics Destination Routing
 *
 * Route analytics events to multiple destinations with unified API.
 * Supports native Sylphx, Google Analytics 4, Mixpanel, Segment, PostHog,
 * and custom destinations.
 *
 * ## Features
 *
 * - **Multi-destination**: Send events to multiple platforms simultaneously
 * - **Consent-aware**: Respect user consent preferences per destination
 * - **Event transformation**: Transform events to destination-specific formats
 * - **Selective routing**: Route specific events to specific destinations
 * - **Fallback handling**: Queue events if destination is unavailable
 *
 * ## Usage
 *
 * @example
 * ```typescript
 * import { createDestinationRouter, GA4Destination, MixpanelDestination } from '@sylphx/sdk'
 *
 * const router = createDestinationRouter({
 *   destinations: [
 *     // Native Sylphx (always enabled)
 *     { type: 'sylphx', config: { apiEndpoint: '/api/sdk/v1/analytics/track' } },
 *     // Google Analytics 4
 *     { type: 'ga4', config: { measurementId: 'G-XXXXXX' }, consentRequired: 'analytics' },
 *     // Mixpanel
 *     { type: 'mixpanel', config: { token: 'xxx' }, consentRequired: 'analytics' },
 *   ],
 * })
 *
 * // Track to all destinations
 * router.track('purchase', { amount: 99.99 })
 *
 * // Track to specific destination
 * router.trackTo('ga4', 'conversion', { value: 99.99 })
 * ```
 */

import type { AnalyticsEvent, EventProperties, UserProperties } from "./types";

// ============================================
// Types
// ============================================

/** Supported destination types */
export type DestinationType =
	| "sylphx"
	| "ga4"
	| "gtm"
	| "mixpanel"
	| "segment"
	| "posthog"
	| "amplitude"
	| "custom";

/** Consent categories (matches consent module) */
export type ConsentCategory =
	| "necessary"
	| "analytics"
	| "marketing"
	| "functional"
	| "preferences";

/** Base destination configuration */
export interface BaseDestinationConfig {
	/** Destination type */
	type: DestinationType;
	/** Human-readable name */
	name?: string;
	/** Required consent category (if any) */
	consentRequired?: ConsentCategory;
	/** Enable/disable destination */
	enabled?: boolean;
	/** Event filter - return true to send event */
	filter?: (event: AnalyticsEvent) => boolean;
	/** Transform event before sending */
	transform?: (event: AnalyticsEvent) => AnalyticsEvent | null;
}

/** Sylphx destination config */
export interface SylphxDestinationConfig extends BaseDestinationConfig {
	type: "sylphx";
	config: {
		apiEndpoint: string;
		apiKey?: string;
		batchSize?: number;
		flushInterval?: number;
	};
}

/** Google Analytics 4 destination config */
export interface GA4DestinationConfig extends BaseDestinationConfig {
	type: "ga4";
	config: {
		measurementId: string;
		debug?: boolean;
	};
}

/** Google Tag Manager destination config */
export interface GTMDestinationConfig extends BaseDestinationConfig {
	type: "gtm";
	config: {
		containerId?: string; // Optional - GTM already loaded
		dataLayerName?: string;
	};
}

/** Mixpanel destination config */
export interface MixpanelDestinationConfig extends BaseDestinationConfig {
	type: "mixpanel";
	config: {
		token: string;
		debug?: boolean;
		trackPageview?: boolean;
	};
}

/** Segment destination config */
export interface SegmentDestinationConfig extends BaseDestinationConfig {
	type: "segment";
	config: {
		writeKey: string;
		cdnUrl?: string;
	};
}

/** PostHog destination config */
export interface PostHogDestinationConfig extends BaseDestinationConfig {
	type: "posthog";
	config: {
		apiKey: string;
		apiHost?: string;
		capturePageview?: boolean;
		capturePageleave?: boolean;
	};
}

/** Amplitude destination config */
export interface AmplitudeDestinationConfig extends BaseDestinationConfig {
	type: "amplitude";
	config: {
		apiKey: string;
		serverUrl?: string;
	};
}

/** Custom destination config */
export interface CustomDestinationConfig extends BaseDestinationConfig {
	type: "custom";
	config: {
		/** Custom track function */
		track: (event: string, properties: EventProperties) => void | Promise<void>;
		/** Custom identify function */
		identify?: (userId: string, traits: UserProperties) => void | Promise<void>;
		/** Custom page function */
		page?: (name: string, properties: EventProperties) => void | Promise<void>;
	};
}

/** All destination configs */
export type DestinationConfig =
	| SylphxDestinationConfig
	| GA4DestinationConfig
	| GTMDestinationConfig
	| MixpanelDestinationConfig
	| SegmentDestinationConfig
	| PostHogDestinationConfig
	| AmplitudeDestinationConfig
	| CustomDestinationConfig;

/** Router configuration */
export interface DestinationRouterConfig {
	/** Destinations to route to */
	destinations: DestinationConfig[];
	/** Check consent function (from consent module) */
	checkConsent?: (category: ConsentCategory) => boolean;
	/** Default consent (if no checkConsent provided) */
	defaultConsent?: boolean;
	/** Debug mode */
	debug?: boolean;
	/** Distinct ID for user identification */
	distinctId?: string;
}

/** Destination router interface */
export interface DestinationRouter {
	/** Track event to all enabled destinations */
	track: (event: string, properties?: EventProperties) => void;
	/** Track event to specific destination */
	trackTo: (
		destinationType: DestinationType,
		event: string,
		properties?: EventProperties,
	) => void;
	/** Identify user across destinations */
	identify: (userId: string, traits?: UserProperties) => void;
	/** Track page view */
	page: (name?: string, properties?: EventProperties) => void;
	/** Get enabled destinations */
	getEnabledDestinations: () => DestinationConfig[];
	/** Enable/disable a destination */
	setDestinationEnabled: (type: DestinationType, enabled: boolean) => void;
	/** Update consent function */
	setConsentChecker: (fn: (category: ConsentCategory) => boolean) => void;
	/** Set distinct ID */
	setDistinctId: (id: string) => void;
}

// ============================================
// Destination Handlers
// ============================================

type TrackHandler = (
	event: string,
	properties: EventProperties,
	config: DestinationConfig["config"],
) => void;
type IdentifyHandler = (
	userId: string,
	traits: UserProperties,
	config: DestinationConfig["config"],
) => void;
type PageHandler = (
	name: string,
	properties: EventProperties,
	config: DestinationConfig["config"],
) => void;

interface DestinationHandler {
	track: TrackHandler;
	identify: IdentifyHandler;
	page: PageHandler;
	init?: (config: DestinationConfig["config"]) => void;
}

/**
 * Sylphx handler - sends to native API
 */
const sylphxHandler: DestinationHandler = {
	track: async (event, properties, config) => {
		const { apiEndpoint, apiKey } = config as SylphxDestinationConfig["config"];
		try {
			const headers: Record<string, string> = {
				"Content-Type": "application/json",
			};
			if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

			navigator.sendBeacon?.(
				apiEndpoint,
				JSON.stringify({
					event,
					properties,
					timestamp: new Date().toISOString(),
				}),
			);
		} catch (error) {
			console.error("[Sylphx] Track error:", error);
		}
	},
	identify: async (userId, traits, config) => {
		const { apiEndpoint, apiKey } = config as SylphxDestinationConfig["config"];
		try {
			const headers: Record<string, string> = {
				"Content-Type": "application/json",
			};
			if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

			await fetch(apiEndpoint, {
				method: "POST",
				headers,
				body: JSON.stringify({
					event: "$identify",
					distinct_id: userId,
					$set: traits,
				}),
			});
		} catch (error) {
			console.error("[Sylphx] Identify error:", error);
		}
	},
	page: async (name, properties, config) => {
		const { apiEndpoint, apiKey } = config as SylphxDestinationConfig["config"];
		try {
			const headers: Record<string, string> = {
				"Content-Type": "application/json",
			};
			if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

			navigator.sendBeacon?.(
				apiEndpoint,
				JSON.stringify({
					event: "$pageview",
					properties: {
						$current_url: window.location.href,
						$title: name || document.title,
						...properties,
					},
					timestamp: new Date().toISOString(),
				}),
			);
		} catch (error) {
			console.error("[Sylphx] Page error:", error);
		}
	},
};

/**
 * GA4 handler - uses gtag
 */
const ga4Handler: DestinationHandler = {
	init: (config) => {
		const { measurementId } = config as GA4DestinationConfig["config"];
		// Initialize dataLayer if not exists
		window.dataLayer = window.dataLayer || [];
		function gtag(...args: unknown[]) {
			window.dataLayer.push(args);
		}
		window.gtag = gtag;
		gtag("js", new Date());
		gtag("config", measurementId);
	},
	track: (event, properties, config) => {
		const { debug } = config as GA4DestinationConfig["config"];
		if (!window.gtag) {
			if (debug) console.warn("[GA4] gtag not available");
			return;
		}

		// Transform to GA4 format
		// Reserved names: https://developers.google.com/analytics/devguides/collection/ga4/reference/events
		const ga4Event = event.replace(/[^a-zA-Z0-9_]/g, "_");
		window.gtag("event", ga4Event, properties);
	},
	identify: (userId, _traits, config) => {
		const { debug } = config as GA4DestinationConfig["config"];
		if (!window.gtag) {
			if (debug) console.warn("[GA4] gtag not available");
			return;
		}
		window.gtag(
			"config",
			(config as GA4DestinationConfig["config"]).measurementId,
			{
				user_id: userId,
			},
		);
	},
	page: (_name, _properties, config) => {
		const { debug } = config as GA4DestinationConfig["config"];
		if (!window.gtag) {
			if (debug) console.warn("[GA4] gtag not available");
			return;
		}
		window.gtag("event", "page_view");
	},
};

/**
 * GTM handler - pushes to dataLayer
 */
const gtmHandler: DestinationHandler = {
	init: (config) => {
		const { dataLayerName = "dataLayer" } =
			config as GTMDestinationConfig["config"];
		window[dataLayerName as "dataLayer"] =
			window[dataLayerName as "dataLayer"] || [];
	},
	track: (event, properties, config) => {
		const { dataLayerName = "dataLayer" } =
			config as GTMDestinationConfig["config"];
		const layer = window[dataLayerName as "dataLayer"];
		if (!layer) return;

		layer.push({
			event,
			...properties,
		});
	},
	identify: (userId, traits, config) => {
		const { dataLayerName = "dataLayer" } =
			config as GTMDestinationConfig["config"];
		const layer = window[dataLayerName as "dataLayer"];
		if (!layer) return;

		layer.push({
			event: "user_identify",
			user_id: userId,
			...traits,
		});
	},
	page: (name, properties, config) => {
		const { dataLayerName = "dataLayer" } =
			config as GTMDestinationConfig["config"];
		const layer = window[dataLayerName as "dataLayer"];
		if (!layer) return;

		layer.push({
			event: "virtual_page_view",
			page_title: name || document.title,
			page_location: window.location.href,
			...properties,
		});
	},
};

/**
 * Mixpanel handler
 */
const mixpanelHandler: DestinationHandler = {
	init: (config) => {
		const { token, debug } = config as MixpanelDestinationConfig["config"];
		// Mixpanel snippet (minified)
		// biome-ignore lint/suspicious/noExplicitAny: Mixpanel SDK types
		((f: any, b: Document) => {
			if (!b) return;
			let e: HTMLScriptElement;
			let g: HTMLScriptElement | null;
			// biome-ignore lint/suspicious/noExplicitAny: Mixpanel SDK types
			let a: any;
			// biome-ignore lint/suspicious/noExplicitAny: Mixpanel SDK types
			const c: any = {};
			c._i = [];
			c.init = (e: string, f: Record<string, unknown>) => {
				c._i.push([e, f]);
			};
			// biome-ignore lint/suspicious/noExplicitAny: Mixpanel SDK types
			c.track = (...args: any[]) => {
				c._i[0]?.[2]?.track?.(...args);
			};
			// biome-ignore lint/suspicious/noExplicitAny: Mixpanel SDK types
			c.identify = (...args: any[]) => {
				c._i[0]?.[2]?.identify?.(...args);
			};
			// biome-ignore lint/suspicious/noExplicitAny: Mixpanel SDK types
			c.people = {
				set: (...args: any[]) => {
					c._i[0]?.[2]?.people?.set?.(...args);
				},
			};
			a = b.createElement("script");
			a.type = "text/javascript";
			a.async = true;
			a.src = "https://cdn.mxpnl.com/libs/mixpanel-2-latest.min.js";
			g = b.getElementsByTagName("script")[0];
			g.parentNode?.insertBefore(a, g);
			f.mixpanel = c;
		})(window, document);

		window.mixpanel?.init(token, { debug });
	},
	track: (event, properties) => {
		window.mixpanel?.track(event, properties);
	},
	identify: (userId, traits) => {
		window.mixpanel?.identify(userId);
		if (traits) {
			window.mixpanel?.people?.set(traits);
		}
	},
	page: (name, properties) => {
		window.mixpanel?.track("$mp_web_page_view", {
			page_name: name,
			...properties,
		});
	},
};

/**
 * Segment handler
 */
const segmentHandler: DestinationHandler = {
	init: (config) => {
		const { writeKey, cdnUrl = "https://cdn.segment.com" } =
			config as SegmentDestinationConfig["config"];
		// Segment Analytics.js snippet
		// biome-ignore lint/suspicious/noExplicitAny: Segment SDK types
		let analytics: any = window.analytics;
		if (!analytics) {
			analytics = [];
			(window as { analytics?: unknown }).analytics = analytics;
		}
		if (!analytics.initialize) {
			if (analytics.invoked) return;
			analytics.invoked = true;
			analytics.methods = [
				"trackSubmit",
				"trackClick",
				"trackLink",
				"trackForm",
				"pageview",
				"identify",
				"reset",
				"group",
				"track",
				"ready",
				"alias",
				"debug",
				"page",
				"once",
				"off",
				"on",
				"addSourceMiddleware",
				"addIntegrationMiddleware",
				"setAnonymousId",
				"addDestinationMiddleware",
			];
			// biome-ignore lint/suspicious/noExplicitAny: Segment SDK types
			analytics.factory =
				(e: string): any =>
				(...args: unknown[]) => {
					args.unshift(e);
					analytics.push(args);
					return analytics;
				};
			for (let e = 0; e < analytics.methods.length; e++) {
				const key = analytics.methods[e];
				analytics[key] = analytics.factory(key);
			}
			analytics.load = (key: string, e?: Record<string, unknown>) => {
				const t = document.createElement("script");
				t.type = "text/javascript";
				t.async = true;
				t.src = `${cdnUrl}/analytics.js/v1/${key}/analytics.min.js`;
				const n = document.getElementsByTagName("script")[0];
				n.parentNode?.insertBefore(t, n);
				analytics._loadOptions = e;
			};
			analytics._writeKey = writeKey;
			analytics.SNIPPET_VERSION = "5.2.1";
			analytics.load(writeKey);
		}
	},
	track: (event, properties) => {
		window.analytics?.track(event, properties);
	},
	identify: (userId, traits) => {
		window.analytics?.identify(userId, traits);
	},
	page: (name, properties) => {
		window.analytics?.page(name, properties);
	},
};

/**
 * PostHog handler
 */
const posthogHandler: DestinationHandler = {
	init: (config) => {
		const { apiKey, apiHost = "https://us.i.posthog.com" } =
			config as PostHogDestinationConfig["config"];
		// PostHog snippet
		// biome-ignore lint/suspicious/noExplicitAny: PostHog SDK types
		((t: any, e: Document) => {
			if (!e) return;
			// biome-ignore lint/suspicious/noExplicitAny: PostHog SDK types
			const o: any = {};
			let n: string;
			const p = [
				"snapshot",
				"capture",
				"identify",
				"alias",
				"people",
				"onFeatureFlags",
				"reloadFeatureFlags",
				"register",
				"unregister",
				"set_config",
				"opt_in_capturing",
				"opt_out_capturing",
				"has_opted_in_capturing",
				"has_opted_out_capturing",
				"clear_opt_in_out_capturing",
				"get_distinct_id",
				"get_property",
				"reset",
				"debug",
			];
			for (n of p) {
				// biome-ignore lint/suspicious/noExplicitAny: PostHog SDK types
				o[n] = (
					(n: string): ((...args: any[]) => void) =>
					(...args: unknown[]) => {
						if (!o.__loaded) {
							o.__load_queue = o.__load_queue || [];
							o.__load_queue.push([n, args]);
						}
					}
				)(n);
			}
			// biome-ignore lint/suspicious/noExplicitAny: PostHog SDK types
			o.people = {
				set: (...args: any[]) => {
					o.__load_queue.push(["people.set", args]);
				},
			};
			o._i = [];
			o.init = (apiKey: string, config: Record<string, unknown>) => {
				o._i.push([apiKey, config]);
				const r = e.createElement("script");
				r.type = "text/javascript";
				r.async = true;
				r.src = "https://us-assets.i.posthog.com/static/array.js";
				const s = e.getElementsByTagName("script")[0];
				s.parentNode?.insertBefore(r, s);
			};
			t.posthog = o;
		})(window, document);

		window.posthog?.init(apiKey, { api_host: apiHost });
	},
	track: (event, properties) => {
		window.posthog?.capture(event, properties);
	},
	identify: (userId, traits) => {
		window.posthog?.identify(userId, traits);
	},
	page: (_name, properties) => {
		window.posthog?.capture("$pageview", properties);
	},
};

/**
 * Amplitude handler
 */
const amplitudeHandler: DestinationHandler = {
	init: (config) => {
		const { apiKey, serverUrl } =
			config as AmplitudeDestinationConfig["config"];
		// Amplitude snippet
		// biome-ignore lint/suspicious/noExplicitAny: Amplitude SDK types
		((e: any, t: Document) => {
			if (!t) return;
			// biome-ignore lint/suspicious/noExplicitAny: Amplitude SDK types
			const r: any = {};
			r._q = [];
			// biome-ignore lint/suspicious/noExplicitAny: Amplitude SDK types
			r.track = (...args: any[]) => {
				r._q.push(["track", args]);
			};
			// biome-ignore lint/suspicious/noExplicitAny: Amplitude SDK types
			r.identify = (...args: any[]) => {
				r._q.push(["identify", args]);
			};
			// biome-ignore lint/suspicious/noExplicitAny: Amplitude SDK types
			r.setUserId = (...args: any[]) => {
				r._q.push(["setUserId", args]);
			};
			r.init = (apiKey: string, options?: Record<string, unknown>) => {
				r._q.push(["init", [apiKey, options]]);
				const n = t.createElement("script");
				n.type = "text/javascript";
				n.async = true;
				n.src =
					"https://cdn.amplitude.com/libs/analytics-browser-2.0.0-min.js.gz";
				const o = t.getElementsByTagName("script")[0];
				o.parentNode?.insertBefore(n, o);
			};
			e.amplitude = r;
		})(window, document);

		window.amplitude?.init(apiKey, serverUrl ? { serverUrl } : undefined);
	},
	track: (event, properties) => {
		window.amplitude?.track(event, properties);
	},
	identify: (userId, traits) => {
		window.amplitude?.setUserId(userId);
		if (traits) {
			window.amplitude?.identify(traits);
		}
	},
	page: (name, properties) => {
		window.amplitude?.track("[Amplitude] Page Viewed", {
			page_name: name,
			...properties,
		});
	},
};

/** Handler registry */
const handlers: Record<DestinationType, DestinationHandler> = {
	sylphx: sylphxHandler,
	ga4: ga4Handler,
	gtm: gtmHandler,
	mixpanel: mixpanelHandler,
	segment: segmentHandler,
	posthog: posthogHandler,
	amplitude: amplitudeHandler,
	custom: {
		track: () => {},
		identify: () => {},
		page: () => {},
	},
};

// ============================================
// Router Implementation
// ============================================

/**
 * Create a destination router
 *
 * @param config - Router configuration
 * @returns Destination router instance
 *
 * @example
 * ```typescript
 * const router = createDestinationRouter({
 *   destinations: [
 *     { type: 'sylphx', config: { apiEndpoint: '/api/sdk/v1/analytics/track' } },
 *     { type: 'ga4', config: { measurementId: 'G-XXXXXX' }, consentRequired: 'analytics' },
 *   ],
 *   checkConsent: (category) => hasConsent(category),
 * })
 *
 * router.track('purchase', { amount: 99.99 })
 * ```
 */
export function createDestinationRouter(
	config: DestinationRouterConfig,
): DestinationRouter {
	const { destinations, defaultConsent = false, debug = false } = config;
	let checkConsent = config.checkConsent || (() => defaultConsent);
	let distinctId = config.distinctId || "";
	const enabledMap = new Map<DestinationType, boolean>();

	// Initialize destinations
	for (const dest of destinations) {
		enabledMap.set(dest.type, dest.enabled !== false);

		// Skip initialization if disabled
		if (dest.enabled === false) continue;

		// Initialize handler
		const handler = handlers[dest.type];
		if (handler.init && dest.type !== "custom") {
			try {
				handler.init(dest.config);
				if (debug) console.log(`[Router] Initialized ${dest.type}`);
			} catch (error) {
				console.error(`[Router] Failed to initialize ${dest.type}:`, error);
			}
		}
	}

	/**
	 * Check if destination should receive event
	 */
	function shouldRoute(dest: DestinationConfig): boolean {
		// Check if enabled
		if (!enabledMap.get(dest.type)) return false;

		// Check consent
		if (dest.consentRequired && !checkConsent(dest.consentRequired)) {
			if (debug)
				console.log(
					`[Router] Consent not granted for ${dest.type} (${dest.consentRequired})`,
				);
			return false;
		}

		return true;
	}

	/**
	 * Build event for routing
	 */
	function buildEvent(
		event: string,
		properties: EventProperties = {},
	): AnalyticsEvent {
		return {
			event,
			properties: {
				...properties,
				$lib: "@sylphx/sdk",
				$lib_version: "1.0.0",
			},
			distinct_id: distinctId,
			timestamp: new Date().toISOString(),
		};
	}

	return {
		track: (event, properties = {}) => {
			const analyticsEvent = buildEvent(event, properties);

			for (const dest of destinations) {
				if (!shouldRoute(dest)) continue;

				// Apply filter
				if (dest.filter && !dest.filter(analyticsEvent)) continue;

				// Apply transform
				const finalEvent = dest.transform
					? dest.transform(analyticsEvent)
					: analyticsEvent;
				if (!finalEvent) continue;

				// Route to handler
				try {
					if (dest.type === "custom") {
						const customConfig =
							dest.config as CustomDestinationConfig["config"];
						customConfig.track(finalEvent.event, finalEvent.properties);
					} else {
						handlers[dest.type].track(
							finalEvent.event,
							finalEvent.properties,
							dest.config,
						);
					}
					if (debug) console.log(`[Router] Tracked "${event}" to ${dest.type}`);
				} catch (error) {
					console.error(`[Router] Failed to track to ${dest.type}:`, error);
				}
			}
		},

		trackTo: (destinationType, event, properties = {}) => {
			const dest = destinations.find((d) => d.type === destinationType);
			if (!dest) {
				console.warn(`[Router] Destination not found: ${destinationType}`);
				return;
			}

			if (!shouldRoute(dest)) return;

			const analyticsEvent = buildEvent(event, properties);

			try {
				if (dest.type === "custom") {
					const customConfig = dest.config as CustomDestinationConfig["config"];
					customConfig.track(analyticsEvent.event, analyticsEvent.properties);
				} else {
					handlers[dest.type].track(
						analyticsEvent.event,
						analyticsEvent.properties,
						dest.config,
					);
				}
				if (debug)
					console.log(`[Router] Tracked "${event}" to ${destinationType}`);
			} catch (error) {
				console.error(`[Router] Failed to track to ${destinationType}:`, error);
			}
		},

		identify: (userId, traits = {}) => {
			distinctId = userId;

			for (const dest of destinations) {
				if (!shouldRoute(dest)) continue;

				try {
					if (dest.type === "custom") {
						const customConfig =
							dest.config as CustomDestinationConfig["config"];
						customConfig.identify?.(userId, traits);
					} else {
						handlers[dest.type].identify(userId, traits, dest.config);
					}
					if (debug) console.log(`[Router] Identified user to ${dest.type}`);
				} catch (error) {
					console.error(`[Router] Failed to identify to ${dest.type}:`, error);
				}
			}
		},

		page: (name, properties = {}) => {
			for (const dest of destinations) {
				if (!shouldRoute(dest)) continue;

				try {
					if (dest.type === "custom") {
						const customConfig =
							dest.config as CustomDestinationConfig["config"];
						customConfig.page?.(name || document.title, properties);
					} else {
						handlers[dest.type].page(
							name || document.title,
							properties,
							dest.config,
						);
					}
					if (debug) console.log(`[Router] Page view to ${dest.type}`);
				} catch (error) {
					console.error(`[Router] Failed to page to ${dest.type}:`, error);
				}
			}
		},

		getEnabledDestinations: () => {
			return destinations.filter((d) => shouldRoute(d));
		},

		setDestinationEnabled: (type, enabled) => {
			enabledMap.set(type, enabled);
		},

		setConsentChecker: (fn) => {
			checkConsent = fn;
		},

		setDistinctId: (id) => {
			distinctId = id;
		},
	};
}

// ============================================
// Type Declarations
// ============================================

declare global {
	interface Window {
		// Mixpanel
		mixpanel?: {
			init: (token: string, config?: Record<string, unknown>) => void;
			track: (event: string, properties?: Record<string, unknown>) => void;
			identify: (userId: string) => void;
			people?: {
				set: (properties: Record<string, unknown>) => void;
			};
		};
		// Segment
		analytics?: {
			load: (writeKey: string) => void;
			track: (event: string, properties?: Record<string, unknown>) => void;
			identify: (userId: string, traits?: Record<string, unknown>) => void;
			page: (name?: string, properties?: Record<string, unknown>) => void;
			[key: string]: unknown;
		};
		// PostHog
		posthog?: {
			init: (apiKey: string, config?: Record<string, unknown>) => void;
			capture: (event: string, properties?: Record<string, unknown>) => void;
			identify: (userId: string, properties?: Record<string, unknown>) => void;
		};
		// Amplitude
		amplitude?: {
			init: (apiKey: string, options?: Record<string, unknown>) => void;
			track: (event: string, properties?: Record<string, unknown>) => void;
			identify: (properties?: Record<string, unknown>) => void;
			setUserId: (userId: string) => void;
		};
	}
}
