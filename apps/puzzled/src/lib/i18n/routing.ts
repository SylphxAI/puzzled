import { createNavigation } from 'next-intl/navigation'
import { defineRouting } from 'next-intl/routing'
import { defaultLocale, locales } from './config'

export const routing = defineRouting({
	// Use all 16 locales from config
	locales: locales,
	defaultLocale: defaultLocale,
	localePrefix: 'as-needed',
	// Disable automatic browser language detection redirect
	// Users stay on default (en) unless they explicitly switch via language picker
	localeDetection: false,
})

export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing)
