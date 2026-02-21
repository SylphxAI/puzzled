/**
 * Shared Network Interceptor
 *
 * Single point of monkey-patching for fetch and XMLHttpRequest.
 * All monitoring modules (breadcrumbs, session replay, dead click detection)
 * register listeners here instead of independently patching globals.
 *
 * This eliminates the fragile chain where each module wraps the previous
 * module's patched version, and restoring one breaks the others.
 *
 * Architecture:
 *   breadcrumbs.ts ──┐
 *   recorder.ts   ───┤──► NetworkInterceptor (patches once) ──► window.fetch / XHR
 *   detectors.ts  ───┘
 */

// ==========================================
// Types
// ==========================================

export interface FetchStartEvent {
	url: string;
	method: string;
	startTime: number;
}

export interface FetchEndEvent {
	url: string;
	method: string;
	startTime: number;
	duration: number;
	status: number;
	ok: boolean;
	error?: string;
}

export interface XHRStartEvent {
	url: string;
	method: string;
	startTime: number;
}

export interface XHREndEvent {
	url: string;
	method: string;
	startTime: number;
	duration: number;
	status: number;
}

export type FetchStartListener = (event: FetchStartEvent) => void;
export type FetchEndListener = (event: FetchEndEvent) => void;
export type XHRStartListener = (event: XHRStartEvent) => void;
export type XHREndListener = (event: XHREndEvent) => void;

interface ListenerSet {
	fetchStart: Set<FetchStartListener>;
	fetchEnd: Set<FetchEndListener>;
	xhrStart: Set<XHRStartListener>;
	xhrEnd: Set<XHREndListener>;
}

// ==========================================
// Singleton State
// ==========================================

let installed = false;
let originalFetch: typeof window.fetch | undefined;
let originalXHROpen: typeof XMLHttpRequest.prototype.open | undefined;
let originalXHRSend: typeof XMLHttpRequest.prototype.send | undefined;

const listeners: ListenerSet = {
	fetchStart: new Set(),
	fetchEnd: new Set(),
	xhrStart: new Set(),
	xhrEnd: new Set(),
};

// ==========================================
// Installation
// ==========================================

/**
 * Install the global network interceptor.
 *
 * Safe to call multiple times -- patches are applied exactly once.
 * Patching happens on first listener registration, not eagerly.
 */
function ensureInstalled(): void {
	if (installed) return;
	if (typeof window === "undefined") return;

	installed = true;

	// Capture the true originals before any patching
	originalFetch = window.fetch.bind(window) as typeof window.fetch;

	if (typeof XMLHttpRequest !== "undefined") {
		originalXHROpen = XMLHttpRequest.prototype.open;
		originalXHRSend = XMLHttpRequest.prototype.send;
	}

	patchFetch();
	patchXHR();
}

/**
 * Extract URL string from any fetch input type.
 * Handles string, Request, and URL objects.
 */
function extractUrl(input: RequestInfo | URL): string {
	if (typeof input === "string") return input;
	if (input instanceof URL) return input.href;
	return (input as Request).url;
}

/**
 * Notify all listeners in a set, guarding against:
 * - Listeners throwing (one failure must not break others)
 * - Set mutation during iteration (snapshot before iterating)
 */
function notify<T>(set: Set<(event: T) => void>, event: T): void {
	const snapshot = Array.from(set);
	for (const listener of snapshot) {
		try {
			listener(event);
		} catch {
			// Listener errors must not break the interceptor or other listeners
		}
	}
}

function patchFetch(): void {
	if (!originalFetch)
		return; // biome-ignore lint/suspicious/noExplicitAny: window.fetch type is read-only in TypeScript, cast required for patching
	(window as any).fetch = async (
		input: RequestInfo | URL,
		init?: RequestInit,
	) => {
		const startTime = Date.now();
		const url = extractUrl(input);
		const method =
			init?.method || (input instanceof Request ? input.method : "GET");

		notify(listeners.fetchStart, {
			url,
			method,
			startTime,
		} satisfies FetchStartEvent);

		try {
			const response = await originalFetch!(input, init);
			const duration = Date.now() - startTime;

			notify(listeners.fetchEnd, {
				url,
				method,
				startTime,
				duration,
				status: response.status,
				ok: response.ok,
			} satisfies FetchEndEvent);

			return response;
		} catch (error) {
			const duration = Date.now() - startTime;

			notify(listeners.fetchEnd, {
				url,
				method,
				startTime,
				duration,
				status: 0,
				ok: false,
				error: error instanceof Error ? error.message : String(error),
			} satisfies FetchEndEvent);

			throw error;
		}
	};
}

function patchXHR(): void {
	if (!originalXHROpen || !originalXHRSend) return;

	XMLHttpRequest.prototype.open = function (
		method: string,
		url: string | URL,
		async?: boolean,
		username?: string | null,
		password?: string | null,
	) {
		const xhr = this as XMLHttpRequest & { _niMethod: string; _niUrl: string };
		xhr._niMethod = method;
		xhr._niUrl = typeof url === "string" ? url : url.href;
		return originalXHROpen!.call(
			this,
			method,
			url,
			async ?? true,
			username,
			password,
		);
	};

	XMLHttpRequest.prototype.send = function (
		body?: XMLHttpRequestBodyInit | null,
	) {
		const xhr = this as XMLHttpRequest & {
			_niMethod: string;
			_niUrl: string;
			_niStart: number;
		};
		xhr._niStart = Date.now();

		notify(listeners.xhrStart, {
			url: xhr._niUrl,
			method: xhr._niMethod,
			startTime: xhr._niStart,
		} satisfies XHRStartEvent);

		this.addEventListener("loadend", () => {
			const duration = Date.now() - xhr._niStart;

			notify(listeners.xhrEnd, {
				url: xhr._niUrl,
				method: xhr._niMethod,
				startTime: xhr._niStart,
				duration,
				status: this.status,
			} satisfies XHREndEvent);
		});

		return originalXHRSend!.call(this, body);
	};
}

// ==========================================
// Public API
// ==========================================

export type UnsubscribeFn = () => void;

/**
 * Register a listener for fetch request completion.
 *
 * Automatically installs the interceptor on first call.
 * Returns an unsubscribe function.
 */
export function onFetchEnd(listener: FetchEndListener): UnsubscribeFn {
	ensureInstalled();
	listeners.fetchEnd.add(listener);
	return () => {
		listeners.fetchEnd.delete(listener);
	};
}

/**
 * Register a listener for fetch request start.
 *
 * Automatically installs the interceptor on first call.
 * Returns an unsubscribe function.
 */
export function onFetchStart(listener: FetchStartListener): UnsubscribeFn {
	ensureInstalled();
	listeners.fetchStart.add(listener);
	return () => {
		listeners.fetchStart.delete(listener);
	};
}

/**
 * Register a listener for XHR request start.
 *
 * Automatically installs the interceptor on first call.
 * Returns an unsubscribe function.
 */
export function onXHRStart(listener: XHRStartListener): UnsubscribeFn {
	ensureInstalled();
	listeners.xhrStart.add(listener);
	return () => {
		listeners.xhrStart.delete(listener);
	};
}

/**
 * Register a listener for XHR request completion.
 *
 * Automatically installs the interceptor on first call.
 * Returns an unsubscribe function.
 */
export function onXHREnd(listener: XHREndListener): UnsubscribeFn {
	ensureInstalled();
	listeners.xhrEnd.add(listener);
	return () => {
		listeners.xhrEnd.delete(listener);
	};
}

/**
 * Remove all listeners and restore original globals.
 *
 * Intended for testing teardown. After calling this,
 * new listener registrations will re-install the patches.
 */
export function resetNetworkInterceptor(): void {
	listeners.fetchStart.clear();
	listeners.fetchEnd.clear();
	listeners.xhrStart.clear();
	listeners.xhrEnd.clear();

	if (!installed) return;
	installed = false;

	if (originalFetch && typeof window !== "undefined") {
		window.fetch = originalFetch;
	}
	if (originalXHROpen && typeof XMLHttpRequest !== "undefined") {
		XMLHttpRequest.prototype.open = originalXHROpen;
	}
	if (originalXHRSend && typeof XMLHttpRequest !== "undefined") {
		XMLHttpRequest.prototype.send = originalXHRSend;
	}

	originalFetch = undefined;
	originalXHROpen = undefined;
	originalXHRSend = undefined;
}
