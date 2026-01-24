import { createNavigation } from 'next-intl/navigation'
import { defineRouting } from 'next-intl/routing'
import { defaultLocale, locales } from './config'

/**
 * Next-intl routing configuration
 *
 * URL Strategy:
 * - en-US (default): / (no prefix)
 * - Other locales: /en-gb/, /zh-hk/, /zh-tw/, /zh-cn/
 *
 * The locale prefix uses lowercase for cleaner URLs
 */
export const routing = defineRouting({
	locales: locales,
	defaultLocale: defaultLocale,

	// Default locale (en-US) has no prefix, others do
	localePrefix: 'as-needed',

	// Disable automatic browser language detection redirect
	// Users stay on default (en-US) unless they explicitly switch
	// This prevents confusing redirects and maintains SEO
	localeDetection: false,

})

// Export locale-aware navigation utilities
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing)
