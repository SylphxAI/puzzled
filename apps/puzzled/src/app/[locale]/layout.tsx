import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import { notFound } from 'next/navigation'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, setRequestLocale } from 'next-intl/server'
import { ErrorCapture } from '@/features/monitoring/components/error-capture'
import { ApiProvider } from '@/lib/api/provider'
import { CLIENT_NAMESPACES, pickMessages } from '@/lib/i18n/client-messages'
import { routing } from '@/lib/i18n/routing'
import { getAppConfig } from '@/lib/identity/app-config'
import { EMPTY_APP_CONFIG } from '@/lib/identity/dest'
import { withPresentationDeadline } from '@/lib/presentation-document'
import { getRequestSiteOrigin } from '@/lib/site-origin.server'
import { DeferredToaster } from '@/shared/components/deferred-shell'
import { PlatformProvider } from '@/shared/components/platform'
import { ThemeProvider } from '@/shared/components/theme'
import '../globals.css'

/**
 * The display face: Fraunces (SIL OFL), instanced for display sizes and
 * subset to Latin (see public/fonts/README.md). Body text uses the platform
 * UI face, so this is the only web font and it is preloaded for the headline.
 */
const fraunces = localFont({
	src: '../fonts/fraunces-display.woff2',
	variable: '--font-display-family',
	weight: '500 700',
	display: 'swap',
	preload: true,
	adjustFontFallback: 'Times New Roman',
})

const SITE_DESCRIPTION =
	'Daily word, logic and number puzzles. One free puzzle every day, no account needed.'
const SITE_KEYWORDS = [
	'games',
	'puzzles',
	'daily games',
	'brain games',
	'word puzzles',
	'logic puzzles',
]

/**
 * Metadata is request-scoped: canonical/OG/JSON-LD must use the origin actually
 * serving the player (puzzled.gg in production, preview host on Cloud preview),
 * never the localhost dev fallback.
 */
export async function generateMetadata(): Promise<Metadata> {
	const baseUrl = await getRequestSiteOrigin()
	return {
		title: {
			default: 'Puzzled',
			template: '%s | Puzzled',
		},
		description: SITE_DESCRIPTION,
		keywords: SITE_KEYWORDS,
		authors: [{ name: 'Puzzled' }],
		creator: 'Puzzled',
		publisher: 'Puzzled',
		metadataBase: new URL(baseUrl),
		// Canonical, hreflang and social cards are per page: Next replaces these
		// objects wholesale, so a route that only sets a title would otherwise
		// drop the layout's hreflang cluster. Every page calls
		// `buildPageMetadata` instead.
		applicationName: 'Puzzled',
		manifest: '/manifest.webmanifest',
		appleWebApp: {
			capable: true,
			statusBarStyle: 'default',
			title: 'Puzzled',
		},
		formatDetection: {
			telephone: false,
		},
	}
}

export const viewport: Viewport = {
	width: 'device-width',
	initialScale: 1,
	viewportFit: 'cover', // Required for safe area insets on iOS PWA
	themeColor: [
		{ media: '(prefers-color-scheme: light)', color: '#f7f4ee' },
		{ media: '(prefers-color-scheme: dark)', color: '#121110' },
	],
}

/**
 * Dynamic rendering: the layout reads the request (origin headers). The app
 * config it also reads is cached for five
 * minutes in `getAppConfig`, so a render does not wait on identity.
 *
 * The proxy.ts handles i18n routing, so generateStaticParams is not needed.
 */
export const dynamic = 'force-dynamic'

type Props = {
	children: React.ReactNode
	params: Promise<{ locale: string }>
}

// JSON-LD structured data for SEO
function JsonLd({ baseUrl }: { baseUrl: string }) {
	const organizationSchema = {
		'@context': 'https://schema.org',
		'@type': 'Organization',
		name: 'Puzzled',
		url: baseUrl,
		logo: `${baseUrl}/icons/icon-512.png`,
		description: SITE_DESCRIPTION,
	}

	const websiteSchema = {
		'@context': 'https://schema.org',
		'@type': 'WebSite',
		name: 'Puzzled',
		url: baseUrl,
		description: SITE_DESCRIPTION,
		potentialAction: {
			'@type': 'SearchAction',
			target: {
				'@type': 'EntryPoint',
				urlTemplate: `${baseUrl}/games?q={search_term_string}`,
			},
			'query-input': 'required name=search_term_string',
		},
	}

	return (
		<>
			<script
				type="application/ld+json"
				// biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD schema with trusted static data
				dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
			/>
			<script
				type="application/ld+json"
				// biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD schema with trusted static data
				dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
			/>
		</>
	)
}

export default async function LocaleLayout({ children, params }: Props) {
	const { locale } = await params
	const baseUrl = await getRequestSiteOrigin()

	// Validate locale
	if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
		notFound()
	}

	// Enable static rendering
	setRequestLocale(locale)

	const [messages, config] = await Promise.all([
		getMessages(),
		withPresentationDeadline(getAppConfig({}), EMPTY_APP_CONFIG),
	])

	return (
		<html lang={locale} suppressHydrationWarning className={fraunces.variable}>
			<head>
				{/* Color scheme for proper dark mode handling */}
				<meta name="color-scheme" content="light dark" />
				{/* Favicon icons */}
				<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
				<link rel="icon" href="/favicon.png" type="image/png" sizes="32x32" />
				<link rel="mask-icon" href="/brand/mark-mono.svg" color="#1a1712" />
				<link rel="icon" href="/favicon.ico" sizes="48x48" />
				<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
				{/*
				 * Fonts are self-hosted by next/font, so no Google Fonts preconnect
				 * is needed. Stripe is only contacted when checkout opens.
				 */}
				<link rel="dns-prefetch" href="https://js.stripe.com" />
				{/* FOUC prevention: Apply theme class before React hydration */}
				<script
					// biome-ignore lint/security/noDangerouslySetInnerHtml: Theme script with trusted static code
					dangerouslySetInnerHTML={{
						__html: `
							(function() {
								try {
									var theme = localStorage.getItem('theme');
									var systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
									// Stored value is next-themes' key: 'light' | 'dark' | 'system'.
									// 'system' (the default) must follow the OS preference; treating it
									// as unset is what closes the first-paint theme flash for it.
									if (theme === 'dark' || ((!theme || theme === 'system') && systemDark)) {
										document.documentElement.classList.add('dark');
									} else if (theme === 'light') {
										document.documentElement.classList.add('light');
									}
									// Calculate scrollbar width for modal compensation
									var scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
									document.documentElement.style.setProperty('--scrollbar-width', scrollbarWidth + 'px');
								} catch (e) {
									// localStorage may be unavailable in incognito or when cookies blocked
									// Gracefully fail - theme will apply via CSS prefers-color-scheme fallback
								}
							})();
						`,
					}}
				/>
				{/*
				 * Consent settle check, before paint like the theme script above.
				 *
				 * The consent banner is the largest contentful paint on mobile, so it
				 * has to render in the first frame - a stored decision must therefore
				 * be honoured before the banner's first paint, or a settled visitor
				 * would see it flash on every load. The test mirrors the SDK's
				 * (`lib/identity/react.tsx`): any stored `puzzled-consent` value that
				 * parses counts as a decision. CSS hides the banner under
				 * `html[data-consent-decided]`; the React tree is untouched, so
				 * hydration stays consistent.
				 */}
				<script
					// biome-ignore lint/security/noDangerouslySetInnerHtml: Consent settle script with trusted static code
					dangerouslySetInnerHTML={{
						__html: `
							(function() {
								try {
									var stored = localStorage.getItem('puzzled-consent');
									if (!stored) return;
									JSON.parse(stored);
									document.documentElement.setAttribute('data-consent-decided', '');
								} catch (error) {
									// Unreadable storage or an unparsable value: leave the banner
									// up - the SDK treats both the same way.
								}
							})();
						`,
					}}
				/>
				<JsonLd baseUrl={baseUrl} />
			</head>
			<body className="antialiased">
				{/* At first paint, outside the providers, so early errors are captured too. */}
				<ErrorCapture />
				<ThemeProvider>
					<PlatformProvider appId={config.app.id} config={config}>
						<ApiProvider>
							<NextIntlClientProvider messages={pickMessages(messages, CLIENT_NAMESPACES)}>
								{children}
							</NextIntlClientProvider>
						</ApiProvider>
						{/* Off the first paint: hosted toasts */}
						<DeferredToaster />
					</PlatformProvider>
				</ThemeProvider>
			</body>
		</html>
	)
}
