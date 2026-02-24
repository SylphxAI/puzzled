import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs))
}

export function formatNumber(num: number, locale = 'en') {
	return new Intl.NumberFormat(locale).format(num)
}

export function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

export function generateId() {
	return crypto.randomUUID()
}

/**
 * Get the base URL for API requests
 *
 * Use cases:
 * - getBaseUrl(): For relative URLs in browser, absolute in SSR (tRPC, API calls)
 * - getBaseUrl('origin'): For absolute URLs that need the actual origin (auth, sharing)
 * - getServerBaseUrl(): For server-side only code (workflows, cron jobs)
 *
 * Priority: NEXT_PUBLIC_APP_URL > VERCEL_URL > localhost
 */
export function getBaseUrl(mode: 'relative' | 'origin' = 'relative'): string {
	if (typeof window !== 'undefined') {
		// Browser: use relative or actual origin
		return mode === 'origin' ? window.location.origin : ''
	}

	// SSR/Server: use environment configuration
	if (process.env.NEXT_PUBLIC_APP_URL) {
		return process.env.NEXT_PUBLIC_APP_URL
	}
	if (process.env.VERCEL_URL) {
		return `https://${process.env.VERCEL_URL}`
	}

	// Fallback for development
	const port = process.env.PORT ?? '3000'
	return `http://localhost:${port}`
}

/**
 * Get base URL for server-side only code
 * Does not check for window - always returns absolute URL
 */
export function getServerBaseUrl(): string {
	if (process.env.NEXT_PUBLIC_APP_URL) {
		return process.env.NEXT_PUBLIC_APP_URL
	}
	if (process.env.VERCEL_URL) {
		return `https://${process.env.VERCEL_URL}`
	}
	return 'http://localhost:3000'
}

/**
 * Escape HTML special characters to prevent XSS in email templates
 */
function _escapeHtml(str: string): string {
	const htmlEntities: Record<string, string> = {
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#39;',
	}
	return str.replace(/[&<>"']/g, (char) => htmlEntities[char] || char)
}
